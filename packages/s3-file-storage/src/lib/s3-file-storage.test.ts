import * as assert from 'node:assert/strict';
import { afterEach, before, after, describe, it } from 'node:test';
import { resolve } from 'node:path';
import { parseFormData } from '@mjackson/form-data-parser';
import { S3FileStorage } from './s3-file-storage.ts';
import { MINIO_PORT, startMinioServer, stopMinioServer, createBucket, clearAllMinioData } from '../../test/minio.ts';

// Test bucket name
const TEST_BUCKET = 'test-bucket';

describe('S3FileStorage', () => {
  let storage: S3FileStorage;

  before(async () => {
    await startMinioServer();

    await createBucket(TEST_BUCKET);

    // Create test storage client connected to MinIO
    storage = new S3FileStorage({
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      region: 'us-east-1',
      bucket: TEST_BUCKET,
      endpoint: `http://localhost:${MINIO_PORT}`,
      forcePathStyle: true,
    });
  });

  after(async () => {
    await stopMinioServer();
    await clearAllMinioData();
  });

  afterEach(async () => {
    // Remove all the files
    const objects = await storage.list();
    for (const object of objects.files) {
        await storage.remove(object.key);
    }
  });

  it('stores and retrieves files', async () => {
    const lastModified = Date.now();
    const file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    });

    await storage.set('hello', file);

    assert.ok(await storage.has('hello'));

    const retrieved = await storage.get('hello');

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'hello.txt');
    assert.equal(retrieved.type, 'text/plain');
    assert.equal(retrieved.lastModified, lastModified);
    assert.equal(retrieved.size, 13);

    const text = await retrieved.text();
    assert.equal(text, 'Hello, world!');

    await storage.remove('hello');

    assert.ok(!(await storage.has('hello')));
    assert.equal(await storage.get('hello'), null);
  });

  it('lists files with pagination', async () => {
    const allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    const { cursor, files } = await storage.list();
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);

    const { cursor: cursor1, files: files1 } = await storage.list({ limit: 0 });
    assert.equal(cursor1, undefined);
    assert.equal(files1.length, 0);

    const { cursor: cursor2, files: files2 } = await storage.list({ limit: 2 });
    assert.ok(cursor2, 'Expected a cursor for pagination');
    assert.equal(files2.length, 2);

    const { cursor: cursor3, files: files3 } = await storage.list({ cursor: cursor2 });
    assert.equal(cursor3, undefined);
    assert.equal(files3.length, 3);

    assert.deepEqual([...files2, ...files3].map((f) => f.key).sort(), allKeys);
  });

  it('lists files by key prefix', async () => {
    // a limitation of minio (not s3) is objects can't collide with prefixes, so b must be b.ext
    // https://min.io/docs/minio/linux/operations/concepts/thresholds.html#conflicting-objects
    const allKeys = ['a', 'b.ext', 'b/c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    const { cursor, files } = await storage.list({ prefix: 'b' });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((f) => f.key).sort(), ['b.ext', 'b/c']);
  });

  it('lists files with metadata', async () => {
    const allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    const { cursor, files } = await storage.list({ includeMetadata: true });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);
    files.forEach((f) => assert.ok('lastModified' in f));
    files.forEach((f) => assert.ok('name' in f));
    files.forEach((f) => assert.ok('size' in f));
    files.forEach((f) => assert.ok('type' in f));
  });

  it('handles race conditions', async () => {
    const lastModified = Date.now();

    const file1 = new File(['Hello, world!'], 'hello1.txt', {
      type: 'text/plain',
      lastModified,
    });

    const file2 = new File(['Hello, universe!'], 'hello2.txt', {
      type: 'text/plain',
      lastModified,
    });

    const setPromise = storage.set('one', file1);
    await storage.set('two', file2);

    const retrieved1 = await storage.get('one');
    assert.ok(retrieved1);
    assert.equal(await retrieved1.text(), 'Hello, world!');

    await setPromise;
    const retrieved2 = await storage.get('two');
    assert.ok(retrieved2);
    assert.equal(await retrieved2.text(), 'Hello, universe!');
  });

  describe('integration with form-data-parser', () => {
    it('stores and lists file uploads', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="hello"; filename="hello.txt"',
          'Content-Type: text/plain',
          '',
          'Hello, world!',
          `--${boundary}--`,
        ].join('\r\n'),
      });

      await parseFormData(request, async (file) => {
        await storage.set('hello', file);
      });

      assert.ok(await storage.has('hello'));

      const { files } = await storage.list({ includeMetadata: true });

      assert.equal(files.length, 1);
      assert.equal(files[0].key, 'hello');
      assert.equal(files[0].name, 'hello.txt');
      assert.equal(files[0].size, 13);
      assert.equal(files[0].type, 'text/plain');
      assert.ok(files[0].lastModified);
    });
  });
});
