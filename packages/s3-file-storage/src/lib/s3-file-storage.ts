import type { FileStorage, FileMetadata, ListOptions, ListResult } from '@mjackson/file-storage';
import { LazyFile } from '@mjackson/lazy-file';
import type { LazyContent } from '@mjackson/lazy-file';
import { AwsClient } from 'aws4fetch';
import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';

/**
 * Type definition for AwsClient constructor parameters
 */
type AwsClientInit = ConstructorParameters<typeof AwsClient>[0];

/**
 * Configuration options for the S3FileStorage client.
 */
export interface S3FileStorageOptions extends Omit<AwsClientInit, 'service'> {
  /**
   * The S3 bucket name to use for storage.
   */
  bucket: string;
  
  /**
   * Optional endpoint for S3-compatible services (e.g., MinIO, DigitalOcean Spaces).
   * If not specified, AWS S3 is used.
   */
  endpoint?: string;

  /**
   * When true, force a path-style endpoint to be used where the bucket name is part of the path. Defaults to false.
   */
  forcePathStyle?: boolean;
}

/**
 * A `FileStorage` that is backed by a bucket on S3.
 *
 * Important: No attempt is made to avoid overwriting existing files.
 */
export class S3FileStorage implements FileStorage {
  private readonly aws: AwsClient;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly forcePathStyle: boolean;
  
  /**
   * Creates a new S3FileStorage instance.
   * @param options Configuration options for S3
   */
  constructor(options: S3FileStorageOptions) {
    // Clone options and set service to 's3'
    const awsOptions: AwsClientInit = {
      ...options,
      service: 's3'
    };
    
    this.aws = new AwsClient(awsOptions);
    this.bucket = options.bucket;
    this.region = options.region || 'us-east-1';
    this.endpoint = options.endpoint || `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    
    if (options.forcePathStyle !== undefined) {
      this.forcePathStyle = !!options.forcePathStyle
    } else {
      // This is how the official s3 client determines if it should use path style or virtual hosted style
      // https://github.com/aws/aws-sdk-js-v3/blob/d1501040077b937ef23e591238cda4bbe729c721/lib/lib-storage/src/Upload.ts#L172-L183
      const endpointHostnameIncludesBucket = new URL(this.endpoint).hostname.startsWith(this.bucket + '.')
      this.forcePathStyle = !endpointHostnameIncludesBucket
    }
  }

  /**
   * Returns the URL for the S3 bucket.
   * If `forcePathStyle` is true, the bucket name is included in the URL.
   */
  private getBucketUrl(): string {
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}`;
    }
    return this.endpoint;
  }
  
  /**
   * Returns the URL for the given key in the S3 bucket.
   */
  private getObjectUrl(key: string): string {
    return `${this.getBucketUrl()}/${encodeURIComponent(key)}`;
  }

  /**
   * Returns `true` if a file with the given key exists, `false` otherwise.
   */
  async has(key: string): Promise<boolean> {
    const response = await this.aws.fetch(this.getObjectUrl(key), {
      method: 'HEAD',
    });

    if (response.ok) return true;
    if (response.status === 404) return false;
    throw new Error(`Failed to check existence of file: ${response.statusText}`);
  }

  /**
   * Puts a file in storage at the given key.
   */
  async set(key: string, file: File): Promise<void> {
    const metadataHeaders = {
      'Content-Type': file.type,
      'x-amz-meta-name': file.name,
      'x-amz-meta-type': file.type,
      'x-amz-meta-lastModified': file.lastModified.toString(),
    };

    let size = null
    try {
      size = file.size;
    } catch (e) {}

    if (size === null || size > 5 * 1024 * 1024 * 1024) {
      // Use multipart upload since we don't know the size or it's too large for a single PUT (5GB)
      return await this.setUsingMultipart(key, file, metadataHeaders);
    }

    // If we're here, we have the file size, so use a simple PUT request
    const response = await this.aws.fetch(this.getObjectUrl(key), {
      method: 'PUT',
      body: file.stream(),
      headers: {
        ...metadataHeaders,
        'Content-Length': size.toString(),
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }
  
  /**
   * Uploads a file using S3 multipart upload.
   * This is used when the file size is unknown or for large files.
   */
  private async setUsingMultipart(
    key: string, 
    file: File, 
    metadataHeaders: Record<string, string>
  ): Promise<void> {
    // Define chunk size as 8MB (Amazon S3 accepts 5MB minimum except for the last part)
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB in bytes
    
    // Start multipart upload
    const initResponse = await this.aws.fetch(`${this.getObjectUrl(key)}?uploads=`, {
      method: 'POST',
      headers: metadataHeaders,
    });
    
    if (!initResponse.ok) {
      throw new Error(`Failed to initiate multipart upload: ${initResponse.statusText}`);
    }
    
    const initXml = await initResponse.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(initXml, 'text/xml');
    
    // Extract the uploadId from the XML response
    const uploadIdElement = xmlDoc.getElementsByTagName('UploadId')[0];
    if (!uploadIdElement || !uploadIdElement.textContent) {
      throw new Error('Failed to get upload ID for multipart upload');
    }
    
    const uploadId = uploadIdElement.textContent;
    
    // Read the stream and upload parts
    const parts: { PartNumber: number; ETag: string }[] = [];
    let partNumber = 1;
    const reader = file.stream().getReader();
    
    try {
      let buffer: Uint8Array[] = [];
      let bufferSize = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done && buffer.length === 0) {
          break;
        }
        
        if (value) {
          buffer.push(value);
          bufferSize += value.byteLength;
        }
        
        if (bufferSize >= CHUNK_SIZE || (done && buffer.length > 0)) {
          // Concatenate chunks into one array
          const chunk = new Uint8Array(bufferSize);
          let offset = 0;
          for (const part of buffer) {
            chunk.set(part, offset);
            offset += part.byteLength;
          }
          
          // Upload this part
          const partResponse = await this.aws.fetch(
            `${this.getObjectUrl(key)}?partNumber=${partNumber}&uploadId=${uploadId}`,
            {
              method: 'PUT',
              body: chunk,
              headers: {
                'Content-Length': chunk.byteLength.toString(),
              },
            }
          );
          
          if (!partResponse.ok) {
            throw new Error(`Failed to upload part ${partNumber}: ${partResponse.statusText}`);
          }
          
          // Get the ETag from the response headers
          const etag = partResponse.headers.get('ETag');
          if (!etag) {
            throw new Error(`No ETag returned for part ${partNumber}`);
          }
          
          parts.push({ PartNumber: partNumber, ETag: etag });
          partNumber++;
          
          // Reset buffer
          buffer = [];
          bufferSize = 0;
        }
        
        if (done) {
          break;
        }
      }
      
      // Complete the multipart upload
      const partsXml = parts.map(part => `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`).join('');
      const completeXml = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
      
      const completeResponse = await this.aws.fetch(
        `${this.getObjectUrl(key)}?uploadId=${uploadId}`,
        {
          method: 'POST',
          body: completeXml,
          headers: {
            'Content-Type': 'application/xml',
            'Content-Length': completeXml.length.toString(),
          },
        }
      );
      
      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        throw new Error(`Failed to complete multipart upload: ${completeResponse.statusText}, Details: ${errorText}`);
      }
    } catch (error) {
      // Abort the multipart upload if there's an error
      try {
        await this.aws.fetch(
          `${this.getObjectUrl(key)}?uploadId=${uploadId}`,
          { method: 'DELETE' }
        );
      } catch (abortError) {
        console.error('Error aborting multipart upload:', abortError);
      }
      
      throw error;
    }
  }

  /**
   * Returns the file with the given key, or `null` if no such key exists.
   * Uses a HEAD request to get metadata and creates a LazyFile that will only fetch the content when needed.
   */
  async get(key: string): Promise<File | null> {
    // First do a HEAD request to get metadata without downloading the file
    const headResponse = await this.aws.fetch(this.getObjectUrl(key), {
      method: 'HEAD',
    });
    
    if (!headResponse.ok) {
      return null;
    }

    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type') || '';
    const lastModifiedHeader = headResponse.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader).getTime() : Date.now();
    
    // Try to get the file name from metadata
    let fileName = key.split('/').pop() || key;
    
    const metadataName = headResponse.headers.get('x-amz-meta-name');
    const metadataLastModified = headResponse.headers.get('x-amz-meta-lastModified');
    const metadataType = headResponse.headers.get('x-amz-meta-type');
    
    if (metadataName) {
      fileName = metadataName;
    }

    // Store AWS client and key in variables that can be captured by the closure
    const aws = this.aws;
    const objectUrl = this.getObjectUrl(key);
    
    // Create LazyContent implementation that will fetch the file only when needed
    const lazyContent: LazyContent = {
      byteLength: contentLength ? parseInt(contentLength, 10) : 0,
      stream(start?: number, end?: number): ReadableStream<Uint8Array> {
        return new ReadableStream({
          async start(controller) {
            const headers: Record<string, string> = {};
            if (start !== undefined || end !== undefined) {

              // it's valid to pass a start without an end
              let range = `bytes=${start ?? 0}-`;
              if (end !== undefined) {
                range += (end - 1);
              }

              headers['Range'] = range;
            }

            try {
              const response = await aws.fetch(objectUrl, {
                method: 'GET',
                headers
              });

              if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
              }

              const reader = response.body!.getReader();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });
      }
    };
    
    return new LazyFile(
      lazyContent,
      fileName,
      {
        type: metadataType || contentType,
        lastModified: metadataLastModified ? parseInt(metadataLastModified, 10) : lastModified
      }
    );
  }
  
  async put(key: string, file: File): Promise<File> {
    await this.set(key, file);
    return (await this.get(key))!;
  }
  
  /**
   * Removes the file with the given key from storage.
   */
  async remove(key: string): Promise<void> {
    await this.aws.fetch(this.getObjectUrl(key), {
      method: 'DELETE',
    });
  }

  /**
   * Lists the files in storage, optionally filtering by prefix.
   * Uses ListObjectsV2 endpoint with XML parsing.
   */
  async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
    let { cursor, includeMetadata = false, limit, prefix } = options ?? {};

    const params = new URLSearchParams();
    
    // Use ListObjectsV2 endpoint
    params.set('list-type', '2');

    if (limit !== undefined) {
      params.set('max-keys', limit!.toString());
    }
    
    if (prefix) {
      params.set('prefix', prefix);
    }
    
    if (cursor) {
      params.set('continuation-token', cursor);
    }
    
    const url = `${this.getBucketUrl()}?${params.toString()}`;
    
    const response = await this.aws.fetch(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list objects: ${response.statusText}`);
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const keys: string[] = [];
    const contents = xml.getElementsByTagName('Contents');
    for (let i = 0; i < contents.length; i++) {
      const content = contents.item(i) as Element;
      const keyElements = content.getElementsByTagName('Key');
      const keyElement = keyElements.item(0);
      const keyText = keyElement?.textContent;
      if (keyText) {
        keys.push(keyText);
      }
    }
    
    // Get NextContinuationToken from XML
    const nextTokenElements = xml.getElementsByTagName('NextContinuationToken');
    const nextTokenElement = nextTokenElements.item(0);
    const nextContinuationToken = nextTokenElement?.textContent ?? undefined;
    
    // Create the result based on whether metadata is requested
    if (includeMetadata) {
      const files: FileMetadata[] = [];
      
      // TODO: make many requests in a queue
      for (const key of keys) {
        const file = await this.get(key);
        files.push({
          key,
          lastModified: file?.lastModified || Date.now(),
          name: file?.name || key.split('/').pop() || key,
          size: file?.size || 0,
          type: file?.type || '',
        });
      }
      
      return {
        files: files as any,
        cursor: nextContinuationToken || undefined,
      };
    } else {
      const files = keys.map(key => ({ key }));
      
      return {
        files: files as any,
        cursor: nextContinuationToken || undefined,
      };
    }
  }
}
