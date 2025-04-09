// filepath: /Users/len/github.com/kevlened/remix-the-web/packages/s3-file-storage/src/lib/s3-file-storage.test.ts
import * as assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { S3FileStorage } from './s3-file-storage.ts';

// Test constants
const TEST_BUCKET = 'test-bucket';
const TEST_ACCESS_KEY = 'test-access-key';
const TEST_SECRET_KEY = 'test-secret-key';
const TEST_REGION = 'us-east-1';
const TEST_ENDPOINT = 'http://localhost:9000';

describe('S3FileStorage', () => {
  let storage: S3FileStorage;
  let originalFetch: typeof fetch;
  let mockResponses: Array<{
    url: string | RegExp;
    method: string;
    handle: (request: Request) => Response | Promise<Response>;
    headers?: Record<string, string>;
    body?: string;
  }>;

  beforeEach(() => {
    mockResponses = [];
    originalFetch = globalThis.fetch;

    // Mock fetch to intercept and respond to specific requests
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = request.url;
      const method = request.method;

      // No responses available
      if (mockResponses.length === 0) {
        console.warn(`No mock responses left for ${method} ${url}`);
        throw new Error(`No mock responses left for ${method} ${url}`);
      }

      // Get the next mock in the queue
      const mock = mockResponses.shift()!;
      
      // Check if the mock matches the request
      const urlMatches = typeof mock.url === 'string' 
        ? url === mock.url 
        : mock.url.test(url);
        
      if (!urlMatches || mock.method !== method) {
        console.warn(`Expected request ${mock.method} ${mock.url}, got ${method} ${url}`);
        throw new Error(`Expected request ${mock.method} ${mock.url}, got ${method} ${url}`);
      }
      
      // Validate headers if specified
      if (mock.headers) {
        for (const [key, value] of Object.entries(mock.headers)) {
          const headerValue = request.headers.get(key);
          if (headerValue !== value) {
            throw new Error(`Expected header ${key}=${value}, got ${headerValue}`);
          }
        }
      }
      
      // Validate body if specified
      if (mock.body !== undefined) {
        const bodyText = await request.clone().text();
        if (bodyText !== mock.body) {
          throw new Error(`Expected body "${mock.body}", got "${bodyText}"`);
        }
      }
      
      // Handle the request and return the response
      return mock.handle(request);
    };

    // Create test storage client
    storage = new S3FileStorage({
      accessKeyId: TEST_ACCESS_KEY,
      secretAccessKey: TEST_SECRET_KEY,
      region: TEST_REGION,
      bucket: TEST_BUCKET,
      endpoint: TEST_ENDPOINT,
      forcePathStyle: true,
    });
  });

  afterEach(() => {
    // Restore the original fetch
    globalThis.fetch = originalFetch;
    mockResponses = [];
  });
  
  // Helper function to create XML responses for S3
  function xmlResponse(content: string, status = 200, headers: Record<string, string> = {}) {
    return new Response(content, {
      status,
      headers: {
        'Content-Type': 'application/xml',
        ...headers
      }
    });
  }

  describe('has()', () => {
    it('returns true when file exists', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'HEAD',
        handle: () => new Response(null, { status: 200 }),
      });

      const result = await storage.has('testfile');
      assert.equal(result, true);
    });

    it('returns false when file does not exist', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/nonexistent`,
        method: 'HEAD',
        handle: () => new Response(null, { status: 404 })
      });

      const result = await storage.has('nonexistent');
      assert.equal(result, false);
    });

    it('throws when response is not ok or 404', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/error`,
        method: 'HEAD',
        // avoid returning a 500, because that triggers a retry
        handle: () => new Response(null, { status: 418, statusText: "I'm a teapot" })
      });

      await assert.rejects(
        async () => await storage.has('error'),
        /Failed to check existence of file: I'm a teapot/
      );
    });
  });

  describe('set()', () => {
    it('sets a file with standard PUT when size is known', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'PUT',
        headers: {
            'content-type': 'text/plain'
        },
        body: 'Hello, world!',
        handle: () => new Response(null, { status: 200 }),
      });

      const testFile = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
      await storage.set('testfile', testFile);
    });

    it('throws an error when PUT response is not ok', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/errorfile`,
        method: 'PUT',
        // avoid returning a 500, because that triggers a retry
        handle: () => new Response(null, { status: 418, statusText: "I'm a teapot" })
      });

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
      
      // Mock multipart upload initiation
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?uploads=`),
        method: 'POST',
        headers: {
            'content-type': 'text/plain',
            'x-amz-meta-name': 'test.txt',
            'x-amz-meta-type': 'text/plain',
        },
        handle: () => {
          return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
            <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>multipartfile</Key>
              <UploadId>test-upload-id</UploadId>
            </InitiateMultipartUploadResult>
          `);
        }
      });
      
      // Mock part upload
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?partNumber=1&uploadId=test-upload-id`),
        method: 'PUT',
        body: 'Hello, world!',
        handle: () => new Response(null, { 
            status: 200, 
            headers: {
                'ETag': '"test-etag"'
            }
        })
      });
      
      // Mock completion
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile\\?uploadId=test-upload-id$`),
        method: 'POST',
        handle: async (request) => {
          // Verify the completion XML body includes the proper ETag
          const bodyXml = await request.text();
          assert.ok(bodyXml.includes('<CompleteMultipartUpload>'));
          assert.ok(bodyXml.includes('<Part>'));
          assert.ok(bodyXml.includes('<PartNumber>1</PartNumber>'));
          assert.ok(bodyXml.includes('<ETag>"test-etag"</ETag>'));
          
          return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
            <CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Location>${TEST_ENDPOINT}/${TEST_BUCKET}/multipartfile</Location>
              <Bucket>${TEST_BUCKET}</Bucket>
              <Key>multipartfile</Key>
              <ETag>"test-etag"</ETag>
            </CompleteMultipartUploadResult>
          `);
        }
      });
      
      await storage.set('multipartfile', testFile);
    });
  });

  describe('get()', () => {
    it('returns null when file does not exist', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/nonexistent`,
        method: 'HEAD',
        handle: () => new Response(null, { status: 404 })
      });

      const result = await storage.get('nonexistent');
      assert.equal(result, null);
    });

    it('creates a File with correct metadata from headers', async () => {
      const lastModified = new Date('2023-01-01T00:00:00Z').getTime();
      
      // Mock the HEAD request to get metadata
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'HEAD',
        handle: () => new Response(null, { 
          status: 200,
          headers: {
            'content-length': '13',
            'content-type': 'text/plain',
            'last-modified': new Date(lastModified).toUTCString(),
            'x-amz-meta-name': 'test.txt',
            'x-amz-meta-type': 'text/plain',
            'x-amz-meta-lastModified': lastModified.toString()
          }
        })
      });

      // Mock the GET request for the content
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'GET',
        handle: () => new Response('Hello, world!', { 
          status: 200,
          headers: {
            'content-type': 'text/plain',
            'content-length': '13'
          }
        })
      });

      const file = await storage.get('testfile');
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
      // Mock the HEAD request to get metadata
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'HEAD',
        handle: () => new Response(null, { 
          status: 200,
          headers: {
            'content-length': '13',
            'content-type': 'text/plain'
          }
        })
      });

      // Mock the GET request with range header
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'GET',
        handle: () => new Response('llo,', { 
          status: 206,
          headers: {
            'content-type': 'text/plain',
            'content-length': '4',
            'content-range': 'bytes 2-5/13'
          }
        })
      });

      const file = await storage.get('testfile');
      assert.ok(file);
      
      // Use the slice method to get a range of bytes
      const blob = file!.slice(2, 6);
      assert.equal(await blob.text(), 'llo,');
    });
  });

  describe('remove()', () => {
    it('deletes a file correctly', async () => {
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'DELETE',
        handle: () => new Response(null, { status: 204 })
      });

      await storage.remove('testfile');
      // If no error, the test passes
    });
  });

  describe('list()', () => {
    it('lists files without metadata', async () => {
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2`),
        method: 'GET',
        handle: () => xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix></Prefix>
            <KeyCount>2</KeyCount>
            <MaxKeys>1000</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>file1</Key>
              <LastModified>2023-01-01T00:00:00.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <Contents>
              <Key>file2</Key>
              <LastModified>2023-01-02T00:00:00.000Z</LastModified>
              <ETag>"etag2"</ETag>
              <Size>200</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `)
      });

      const result = await storage.list();
      assert.equal(result.cursor, undefined);
      assert.equal(result.files.length, 2);
      assert.deepEqual(result.files.map(f => f.key), ['file1', 'file2']);
    });

    it('handles pagination correctly', async () => {
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*max-keys=2`),
        method: 'GET',
        handle: () => xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix></Prefix>
            <KeyCount>2</KeyCount>
            <MaxKeys>2</MaxKeys>
            <IsTruncated>true</IsTruncated>
            <Contents>
              <Key>file1</Key>
              <LastModified>2023-01-01T00:00:00.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <Contents>
              <Key>file2</Key>
              <LastModified>2023-01-02T00:00:00.000Z</LastModified>
              <ETag>"etag2"</ETag>
              <Size>200</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <NextContinuationToken>token123</NextContinuationToken>
          </ListBucketResult>
        `)
      });

      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*continuation-token=token123`),
        method: 'GET',
        handle: () => xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix></Prefix>
            <KeyCount>1</KeyCount>
            <MaxKeys>2</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>file3</Key>
              <LastModified>2023-01-03T00:00:00.000Z</LastModified>
              <ETag>"etag3"</ETag>
              <Size>300</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `)
      });

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
    });

    it('filters by prefix correctly', async () => {
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2.*prefix=folder%2F`),
        method: 'GET',
        handle: () => xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix>folder/</Prefix>
            <KeyCount>2</KeyCount>
            <MaxKeys>1000</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>folder/file1</Key>
              <LastModified>2023-01-01T00:00:00.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
            <Contents>
              <Key>folder/file2</Key>
              <LastModified>2023-01-02T00:00:00.000Z</LastModified>
              <ETag>"etag2"</ETag>
              <Size>200</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `)
      });

      const result = await storage.list({ prefix: 'folder/' });
      assert.equal(result.cursor, undefined);
      assert.equal(result.files.length, 2);
      assert.deepEqual(result.files.map(f => f.key), ['folder/file1', 'folder/file2']);
    });

    it('includes metadata when requested', async () => {
      // First mock the list request
      mockResponses.push({
        url: new RegExp(`${TEST_ENDPOINT}/${TEST_BUCKET}\\?list-type=2`),
        method: 'GET',
        handle: () => xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
            <Name>${TEST_BUCKET}</Name>
            <Prefix></Prefix>
            <KeyCount>1</KeyCount>
            <MaxKeys>1000</MaxKeys>
            <IsTruncated>false</IsTruncated>
            <Contents>
              <Key>file1</Key>
              <LastModified>2023-01-01T00:00:00.000Z</LastModified>
              <ETag>"etag1"</ETag>
              <Size>100</Size>
              <StorageClass>STANDARD</StorageClass>
            </Contents>
          </ListBucketResult>
        `)
      });

      // Then mock the HEAD request that will be made for metadata
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/file1`,
        method: 'HEAD',
        handle: () => new Response(null, { 
          status: 200,
          headers: {
            'content-length': '13',
            'content-type': 'text/plain',
            'last-modified': new Date('2023-01-01T00:00:00Z').toUTCString(),
            'x-amz-meta-name': 'test.txt',
            'x-amz-meta-type': 'text/plain',
            'x-amz-meta-lastModified': '1672531200000'
          }
        })
      });

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
    });
  });

  describe('put()', () => {
    it('sets and gets a file in one operation', async () => {
      // Mock the set operation (PUT)
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'PUT',
        handle: () => new Response(null, { status: 200 })
      });
      
      // Mock the get operation (HEAD)
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'HEAD',
        handle: () => new Response(null, { 
          status: 200,
          headers: {
            'content-length': '13',
            'content-type': 'text/plain',
            'x-amz-meta-name': 'test.txt',
            'x-amz-meta-type': 'text/plain',
            'x-amz-meta-lastModified': '1672531200000'
          }
        })
      });

      // The get operation will require a GET request for the content as well
      mockResponses.push({
        url: `${TEST_ENDPOINT}/${TEST_BUCKET}/testfile`,
        method: 'GET',
        handle: () => new Response('Hello, world!', { status: 200 })
      });
      
      const testFile = new File(['Hello, world!'], 'test.txt', { 
        type: 'text/plain',
        lastModified: new Date('2023-01-01T00:00:00Z').getTime()
      });
      
      const result = await storage.put('testfile', testFile);
      assert.ok(result instanceof File);
      assert.equal(result.name, 'test.txt');
      assert.equal(result.type, 'text/plain');
      assert.equal(result.lastModified, new Date('2023-01-01T00:00:00Z').getTime());
      
      // Verify content
      const content = await result.text();
      assert.equal(content, 'Hello, world!');
    });
  });
});
