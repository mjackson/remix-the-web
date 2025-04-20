// filepath: /Users/len/github.com/kevlened/remix-the-web/packages/s3-file-storage/src/lib/s3-file-storage.test.ts
import * as assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { S3FileStorage } from './s3-file-storage.ts';
import { LazyFile } from '@mjackson/lazy-file';

// Test constants
const TEST_BUCKET = 'test-bucket';
const TEST_ACCESS_KEY = 'test-access-key';
const TEST_SECRET_KEY = 'test-secret-key';
const TEST_REGION = 'us-east-1';
const TEST_ENDPOINT = 'http://localhost:9000';

describe('S3FileStorage', () => {
  let storage: S3FileStorage;
  let eagerStorage: S3FileStorage;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    
    // Create test storage client
    storage = new S3FileStorage({
      accessKeyId: TEST_ACCESS_KEY,
      secretAccessKey: TEST_SECRET_KEY,
      region: TEST_REGION,
      bucket: TEST_BUCKET,
      endpoint: TEST_ENDPOINT,
      forcePathStyle: true,
    });

    eagerStorage = new S3FileStorage({
      accessKeyId: TEST_ACCESS_KEY,
      secretAccessKey: TEST_SECRET_KEY,
      region: TEST_REGION,
      bucket: TEST_BUCKET,
      endpoint: TEST_ENDPOINT,
      forcePathStyle: true,
      eager: true
    });
  });

  afterEach(() => {
    // Restore the original fetch
    globalThis.fetch = originalFetch;
  });
  
  // Helper function to create XML responses for S3
  function xmlResponse(content: string, status = 200, headers: Record<string, string> = {}) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?>\n' + content, {
      status,
      headers: {
        'Content-Type': 'application/xml',
        ...headers
      }
    });
  }

  describe('has()', () => {
    it('returns true when file exists', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
        assert.equal(request.method, 'HEAD');
        return new Response(null, { status: 200 });
      };

      const result = await storage.has('testfile');
      assert.equal(result, true);
    });

    it('returns false when file does not exist', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/nonexistent`);
        assert.equal(request.method, 'HEAD');
        return new Response(null, { status: 404 });
      };

      const result = await storage.has('nonexistent');
      assert.equal(result, false);
    });

    it('throws when response is not ok or 404', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/error`);
        assert.equal(request.method, 'HEAD');
        // avoid returning a 500, because that triggers a retry
        return new Response(null, { status: 418, statusText: "I'm a teapot" });
      };

      await assert.rejects(
        async () => await storage.has('error'),
        /Failed to check existence of file: I'm a teapot/
      );
    });
  });

  describe('set()', () => {
    it('sets a file with standard PUT when size is known', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
        assert.equal(request.method, 'PUT');
        assert.equal(request.headers.get('content-type'), 'text/plain');
        
        // Verify the body content
        const bodyText = await request.text();
        assert.equal(bodyText, 'Hello, world!');
        
        return new Response(null, { status: 200 });
      };

      const testFile = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      await storage.set('testfile', testFile);
    });

    it('throws an error when PUT response is not ok', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/errorfile`);
        assert.equal(request.method, 'PUT');
        
        // avoid returning a 500, because that triggers a retry
        return new Response(null, { status: 418, statusText: "I'm a teapot" });
      };

      const testFile = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      
      await assert.rejects(
        async () => await storage.set('errorfile', testFile),
        /Failed to upload file: I'm a teapot/
      );
    });

    it('uses multipart upload when file size is unknown', async () => {
      // Create a file with unknown size
      const testFile = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(testFile, 'size', {
        get: () => { throw new Error('Size not available'); }
      });
      
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        const url = request.url;
        const method = request.method;
        
        if (callIndex === 0) {
          // First request: initiate multipart upload
          assert.equal(method, 'POST');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?uploads=`));
          
          // Verify headers
          assert.equal(request.headers.get('content-type'), 'text/plain');
          assert.equal(request.headers.get('x-amz-meta-name'), 'test.txt');
          
          return xmlResponse(`
            <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>multipartfile</Key>
              <UploadId>test-upload-id</UploadId>
            </InitiateMultipartUploadResult>
          `);
        } 
        
        if (callIndex === 1) {
          // Second request: upload part
          assert.equal(method, 'PUT');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?partNumber=1&uploadId=test-upload-id`));
          
          // Verify body
          const bodyText = await request.text();
          assert.equal(bodyText, 'Hello, world!');
          
          return new Response(null, { 
            status: 200, 
            headers: {
              'ETag': '"test-etag"'
            }
          });
        }
        
        if (callIndex === 2) {
          // Third request: complete multipart upload
          assert.equal(method, 'POST');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?uploadId=test-upload-id$`));
          
          // Verify the completion XML body
          const bodyXml = await request.text();
          assert.equal(bodyXml, '<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>"test-etag"</ETag></Part></CompleteMultipartUpload>');
          
          return xmlResponse(`
            <CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Location>${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile</Location>
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>multipartfile</Key>
              <ETag>"test-etag"</ETag>
            </CompleteMultipartUploadResult>
          `);
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${method} ${url}`);
      };
      
      await storage.set('multipartfile', testFile);
      
      // Verify all expected requests were made
      assert.equal(callIndex, 2, `Expected 3 requests, but got ${callIndex + 1}`);
    });

    it('handles large files correctly with multipart upload', async () => {
      // Use the real 8MB chunk size from the implementation
      const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
      // Define the total file size - larger than chunk size
      const FILE_SIZE = 10 * 1024 * 1024; // 10MB
      
      // Create a LazyContent implementation that generates data on-demand
      const lazyContent = {
        byteLength: FILE_SIZE,
        stream: () => {
          let generatedBytes = 0;
          
          return new ReadableStream({
            pull(controller) {
              if (generatedBytes >= FILE_SIZE) {
                controller.close();
                return;
              }
              
              // Generate chunks of 1MB at a time to avoid large allocations
              const chunkSize = Math.min(1 * 1024 * 1024, FILE_SIZE - generatedBytes);
              const chunk = new Uint8Array(chunkSize);
              
              // Fill with 'A' (charCode 65)
              chunk.fill(65);
              
              controller.enqueue(chunk);
              generatedBytes += chunkSize;
            }
          });
        }
      };
      
      // Create a LazyFile with our large content
      const testFile = new LazyFile(lazyContent, 'large.txt', { type: 'text/plain' });
      
      // Force the file to have an unknown size so we perform a multipart upload
      Object.defineProperty(testFile, 'size', {
        get: () => { throw new Error('Size not available'); }
      });
      
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        const url = request.url;
        const method = request.method;
        
        if (callIndex === 0) {
          // First request: initiate multipart upload
          assert.equal(method, 'POST');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/largefile\\?uploads=`));
          
          // Verify headers
          assert.equal(request.headers.get('content-type'), 'text/plain');
          assert.equal(request.headers.get('x-amz-meta-name'), 'large.txt');
          
          return xmlResponse(`
            <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>largefile</Key>
              <UploadId>test-upload-id-large</UploadId>
            </InitiateMultipartUploadResult>
          `);
        } 
        
        if (callIndex === 1) {
          // Second request: upload first part (ABCDE)
          assert.equal(method, 'PUT');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/largefile\\?partNumber=1&uploadId=test-upload-id-large`));
          
          // Verify first chunk is exactly the CHUNK_SIZE (8MB)
          const body = await request.arrayBuffer();
          assert.equal(body.byteLength, CHUNK_SIZE);
          
          return new Response(null, { 
            status: 200, 
            headers: {
              'ETag': '"etag-part1"'
            }
          });
        }
        
        if (callIndex === 2) {
          // Third request: upload second part
          assert.equal(method, 'PUT');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/largefile\\?partNumber=2&uploadId=test-upload-id-large`));
          
          // Verify the size of the second chunk is the remaining 2MB
          const body = await request.arrayBuffer();
          assert.equal(body.byteLength, FILE_SIZE - CHUNK_SIZE);
          
          return new Response(null, { 
            status: 200, 
            headers: {
              'ETag': '"etag-part2"'
            }
          });
        }
        
        if (callIndex === 3) {
          // Fifth request: complete multipart upload
          assert.equal(method, 'POST');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/largefile\\?uploadId=test-upload-id-large$`));
          
          // Verify the completion XML body
          const bodyXml = await request.text();
          const expectedXml = '<CompleteMultipartUpload>' +
            '<Part><PartNumber>1</PartNumber><ETag>"etag-part1"</ETag></Part>' +
            '<Part><PartNumber>2</PartNumber><ETag>"etag-part2"</ETag></Part>' + 
            '</CompleteMultipartUpload>';
          assert.equal(bodyXml, expectedXml);
          
          return xmlResponse(`
            <CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Location>${TEST_ENDPOINT}/${TEST_BUCKET}/largefile</Location>
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>largefile</Key>
              <ETag>"final-etag"</ETag>
            </CompleteMultipartUploadResult>
          `);
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${method} ${url}`);
      };
      
      // Create a mock streaming file
      await storage.set('largefile', testFile);
      
      // Verify all expected requests were made
      assert.equal(callIndex, 3, `Expected 4 requests, but got ${callIndex + 1}`);
    });
  });

  describe('get()', () => {
    it('returns null when file does not exist', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/nonexistent`);
        assert.equal(request.method, 'HEAD');
        return new Response(null, { status: 404 });
      };

      const result = await storage.get('nonexistent');
      assert.equal(result, null);
    });

    it('creates a File with correct metadata from headers', async () => {
      const lastModified = new Date('1999-12-31T23:59:59Z').getTime();
      
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        
        if (callIndex === 0) {
          // First request: HEAD request to get metadata
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'HEAD');
          
          return new Response(null, { 
            status: 200,
            headers: {
              'content-length': '13',
              'content-type': 'text/plain',
              'last-modified': new Date(lastModified).toUTCString(),
              'x-amz-meta-name': 'test.txt',
              'x-amz-meta-type': 'text/plain',
              'x-amz-meta-lastModified': lastModified.toString()
            }
          });
        }
        
        if (callIndex === 1) {
          // Second request: GET request for the content
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'GET');
          
          return new Response('Hello, world!', { 
            status: 200,
            headers: {
              'content-type': 'text/plain',
              'content-length': '13'
            }
          });
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${request.method} ${request.url}`);
      };

      const file = await storage.get('testfile');
      assert.ok(file instanceof File);
      assert.equal(file!.name, 'test.txt');
      assert.equal(file!.type, 'text/plain');
      assert.equal(file!.size, 13);
      assert.equal(file!.lastModified, lastModified);
      
      // Check that the content is correctly loaded
      const content = await file!.text();
      assert.equal(content, 'Hello, world!');
      
      // Verify both expected requests were made
      assert.equal(callIndex, 1, `Expected 2 requests, but got ${callIndex + 1}`);
    });

    it('creates a File with correct metadata from headers using eager', async () => {
      const lastModified = new Date('1999-12-31T23:59:59Z').getTime();
      
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
        assert.equal(request.method, 'GET');
        
        return new Response('Hello, world!', { 
          status: 200,
          headers: {
            'content-length': '13',
            'content-type': 'text/plain',
            'last-modified': new Date(lastModified).toUTCString(),
            'x-amz-meta-name': 'test.txt',
            'x-amz-meta-lastModified': lastModified.toString()
          }
        });
      };

      const file = await eagerStorage.get('testfile');
      assert.ok(file instanceof File);
      assert.equal(file!.name, 'test.txt');
      assert.equal(file!.type, 'text/plain');
      assert.equal(file!.size, 13);
      assert.equal(file!.lastModified, lastModified);
      
      // Check that the content is correctly loaded
      const content = await file!.text();
      assert.equal(content, 'Hello, world!');
    });

    it('handles range requests correctly', async () => {
      const lastModified = new Date('1999-12-31T23:59:59Z').getTime();

      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        
        if (callIndex === 0) {
          // First request: GET request without range header
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'HEAD');
          
          return new Response('Hello, world!', { 
            status: 200,
            headers: {
              'content-length': '13',
              'content-type': 'text/plain',
              'last-modified': new Date(lastModified).toUTCString(),
              'x-amz-meta-name': 'test.txt',
              'x-amz-meta-lastModified': lastModified.toString()
            }
          });
        }
        
        if (callIndex === 1) {
          // Second request: GET request with range header
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'GET');
          assert.equal(request.headers.get('range'), 'bytes=2-5');
          
          return new Response('llo,', { 
            status: 206,
            headers: {
              'content-type': 'text/plain',
              'content-length': '4',
              'content-range': 'bytes 2-5/13'
            }
          });
        }

        if (callIndex === 2) {
          // Third request: GET request with a different range header
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'GET');
          assert.equal(request.headers.get('range'), 'bytes=3-6');
          
          return new Response('lo, ', { 
            status: 206,
            headers: {
              'content-type': 'text/plain',
              'content-length': '4',
              'content-range': 'bytes 3-6/13'
            }
          });
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${request.method} ${request.url}`);
      };

      const file = await storage.get('testfile');
      assert.ok(file);
      
      // Use the slice method to get a range of bytes
      const blob1 = file!.slice(2, 6);
      assert.equal(await blob1.text(), 'llo,');

      // Use the slice method to get a range of bytes
      const blob2 = file!.slice(3, 7);
      assert.equal(await blob2.text(), 'lo, ');
      
      // Verify all expected requests were made
      assert.equal(callIndex, 2, `Expected 3 requests, but got ${callIndex + 1}`);
    });
  });

  describe('remove()', () => {
    it('deletes a file correctly', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
        assert.equal(request.method, 'DELETE');
        return new Response(null, { status: 204 });
      };

      await storage.remove('testfile');
      // If no error, the test passes
    });
  });

  describe('list()', () => {
    it('lists files without metadata', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.method, 'GET');
        assert.match(request.url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2`));
        
        return xmlResponse(`
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix></Prefix>
            <KeyCount>2</KeyCount>
            <MaxKeys>1000</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>file1</Key>
              <LastModified>1999-12-31T23:59:59.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <Contents>
              <Key>file2</Key>
              <LastModified>1999-12-31T23:59:59.000Z</LastModified>
              <ETag>"etag2"</ETag>
              <Size>200</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `);
      };

      const result = await storage.list();
      assert.equal(result.cursor, undefined);
      assert.equal(result.files.length, 2);
      assert.deepEqual(result.files.map(f => f.key), ['file1', 'file2']);
    });

    it('handles pagination correctly', async () => {
      let callCount = 0;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = request.url;
        callCount++;
        
        if (callCount === 1) {
          // First request (for first page)
          assert.equal(request.method, 'GET');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*max-keys=2`));
          
          return xmlResponse(`
            <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Name>${TEST_BUCKET}</Name>
              <Prefix></Prefix>
              <KeyCount>2</KeyCount>
              <MaxKeys>2</MaxKeys>
              <IsTruncated>true</IsTruncated>
              <Contents>
                <Key>file1</Key>
                <LastModified>1999-12-31T23:59:59.000Z</LastModified>
                <ETag>"etag1"</ETag>
                <Size>100</Size>
                <StorageClass>STANDARD</StorageClass>
              </Contents>
              <Contents>
                <Key>file2</Key>
                <LastModified>1999-12-31T23:59:59.000Z</LastModified>
                <ETag>"etag2"</ETag>
                <Size>200</Size>
                <StorageClass>STANDARD</StorageClass>
              </Contents>
              <NextContinuationToken>token123</NextContinuationToken>
            </ListBucketResult>
          `);
        }
        
        if (callCount === 2) {
          // Second request (for second page)
          assert.equal(request.method, 'GET');
          assert.match(url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*continuation-token=token123`));
          
          return xmlResponse(`
            <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Name>${TEST_BUCKET}</Name>
              <Prefix></Prefix>
              <KeyCount>1</KeyCount>
              <MaxKeys>2</MaxKeys>
              <IsTruncated>false</IsTruncated>
              <Contents>
                <Key>file3</Key>
                <LastModified>1999-12-31T23:59:59.000Z</LastModified>
                <ETag>"etag3"</ETag>
                <Size>300</Size>
                <StorageClass>STANDARD</StorageClass>
              </Contents>
            </ListBucketResult>
          `);
        }
        
        throw new Error(`Unexpected request #${callCount}: ${request.method} ${url}`);
      };

      // First page
      const result1 = await storage.list({ limit: 2 });
      assert.equal(result1.cursor, 'token123');
      assert.equal(result1.files.length, 2);
      assert.deepEqual(result1.files.map(f => f.key), ['file1', 'file2']);

      // Second page
      const result2 = await storage.list({ cursor: result1.cursor });
      assert.equal(result2.cursor, undefined);
      assert.equal(result2.files.length, 1);
      assert.deepEqual(result2.files.map(f => f.key), ['file3']);
      
      // Verify we made exactly 2 requests
      assert.equal(callCount, 2, "Expected exactly 2 calls to fetch");
    });

    it('filters by prefix correctly', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(request.method, 'GET');
        assert.match(request.url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*prefix=folder%2F`));
        
        return xmlResponse(`
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix>folder/</Prefix>
            <KeyCount>2</KeyCount>
            <MaxKeys>1000</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>folder/file1</Key>
              <LastModified>1999-12-31T23:59:59.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <Contents>
              <Key>folder/file2</Key>
              <LastModified>1999-12-31T23:59:59.000Z</LastModified>
              <ETag>"etag2"</ETag>
              <Size>200</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `);
      };

      const result = await storage.list({ prefix: 'folder/' });
      assert.equal(result.cursor, undefined);
      assert.equal(result.files.length, 2);
      assert.deepEqual(result.files.map(f => f.key), ['folder/file1', 'folder/file2']);
    });

    it('includes metadata when requested', async () => {
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        
        if (callIndex === 0) {
          // First request: list request
          assert.equal(request.method, 'GET');
          assert.match(request.url, new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2`));
          
          return xmlResponse(`
            <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Name>${TEST_BUCKET}</Name>
              <Prefix></Prefix>
              <KeyCount>1</KeyCount>
              <MaxKeys>1000</MaxKeys>
              <IsTruncated>false</IsTruncated>
              <Contents>
                <Key>file1</Key>
                <LastModified>1999-12-31T23:59:59.000Z</LastModified>
                <ETag>"etag1"</ETag>
                <Size>100</Size>
                <StorageClass>STANDARD</StorageClass>
              </Contents>
            </ListBucketResult>
          `);
        }
        
        if (callIndex === 1) {
          // Second request: HEAD request for metadata
          assert.equal(request.method, 'HEAD');
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/file1`);
          
          return new Response(null, { 
            status: 200,
            headers: {
              'content-length': '13',
              'content-type': 'text/plain',
              'last-modified': new Date('1999-12-31T23:59:59Z').toUTCString(),
              'x-amz-meta-name': 'test.txt',
              'x-amz-meta-lastModified': '1672531200000'
            }
          });
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${request.method} ${request.url}`);
      };

      const result = await storage.list({ includeMetadata: true });
      assert.equal(result.cursor, undefined);
      assert.equal(result.files.length, 1);
      
      // Check that the file object includes metadata
      const file = result.files[0];
      assert.equal(file.key, 'file1');
      assert.equal(file.name, 'test.txt');
      assert.equal(file.type, 'text/plain');
      assert.ok(file.lastModified);
      assert.equal(file.size, 13);
      
      // Verify both expected requests were made
      assert.equal(callIndex, 1, `Expected 2 requests, but got ${callIndex + 1}`);
    });
  });

  describe('put()', () => {
    it('sets and gets a file in one operation', async () => {
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);
        
        if (callIndex === 0) {
          // First request: PUT request to upload the file
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'PUT');
          
          // Verify the body content
          const bodyText = await request.text();
          assert.equal(bodyText, 'Hello, world!');
          
          return new Response(null, { status: 200 });
        }
        
        if (callIndex === 1) {
          // Second request: HEAD request to get metadata
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'HEAD');
          
          return new Response(null, { 
            status: 200,
            headers: {
              'content-length': '13',
              'content-type': 'text/plain',
              'x-amz-meta-name': 'test.txt',
              'x-amz-meta-type': 'text/plain',
              'x-amz-meta-lastModified': '946684799000'
            }
          });
        }
        
        if (callIndex === 2) {
          // Third request: GET request to get content
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'GET');
          
          return new Response('Hello, world!', { status: 200 });
        }
        
        throw new Error(`Unexpected request #${callIndex + 1}: ${request.method} ${request.url}`);
      };
      
      const testFile = new File(['Hello, world!'], 'test.txt', { 
        type: 'text/plain',
        lastModified: new Date('1999-12-31T23:59:59Z').getTime()
      });
      
      const result = await storage.put('testfile', testFile);
      assert.ok(result instanceof File);
      assert.equal(result.name, 'test.txt');
      assert.equal(result.type, 'text/plain');
      assert.equal(result.lastModified, new Date('1999-12-31T23:59:59Z').getTime());
      
      // Verify content
      const content = await result.text();
      assert.equal(content, 'Hello, world!');
      
      // Verify all expected requests were made
      assert.equal(callIndex, 2, `Expected 3 requests, but got ${callIndex + 1}`);
    });

    it('sets and gets a file in one operation using eager', async () => {
      let callIndex = -1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        callIndex++;
        const request = new Request(input, init);

        if (callIndex === 0) {
          // First request: PUT request to upload the file
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'PUT');

          // Verify the body content
          const bodyText = await request.text();
          assert.equal(bodyText, 'Hello, world!');

          return new Response(null, { status: 200 });
        }

        if (callIndex === 1) {
          // Second request: HEAD request to get metadata
          assert.equal(request.url, `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`);
          assert.equal(request.method, 'GET');

          return new Response('Hello, world!', { 
            status: 200,
            headers: {
              'content-length': '13',
              'content-type': 'text/plain',
              'x-amz-meta-name': 'test.txt',
              'x-amz-meta-lastModified': '946684799000'
            }
          });
        }

        throw new Error(`Unexpected request #${callIndex + 1}: ${request.method} ${request.url}`);
      };

      const testFile = new File(['Hello, world!'], 'test.txt', { 
        type: 'text/plain',
        lastModified: new Date('1999-12-31T23:59:59Z').getTime()
      });

      const result = await eagerStorage.put('testfile', testFile);
      assert.ok(result instanceof File);
      assert.equal(result.name, 'test.txt');
      assert.equal(result.type, 'text/plain');
      assert.equal(result.lastModified, new Date('1999-12-31T23:59:59Z').getTime());

      // Verify content
      const content = await result.text();
      assert.equal(content, 'Hello, world!');

      // Verify all expected requests were made
      assert.equal(callIndex, 1, `Expected 2 requests, but got ${callIndex + 1}`);
    });
  });
});
