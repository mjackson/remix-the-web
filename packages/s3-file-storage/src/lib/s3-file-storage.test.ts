import * as assert from 'node:assert/strict';
import { afterEach, before, after, describe, it } from 'node:test';
import { resolve, dirname } from 'node:path';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFormData } from '@mjackson/form-data-parser';
import { S3FileStorage } from './s3-file-storage.ts';
import { S3_ENDPOINT, startMinioServer, stopMinioServer, createBucket, clearAllMinioData } from '../../test/minio.ts';
import { overrideGlobalFetch, resetGlobalFetch } from '../../test/record-replay.ts';

// Test bucket name
const TEST_BUCKET = 'test-bucket';

// For controlling record/playback mode
const RECORD_MODE = process.env.RECORD_MODE === 'record' ? 'record' : 'playback';

// Get the directory name in ES modules
const currentDir = dirname(fileURLToPath(import.meta.url));
// Directory for test fixtures
const FIXTURES_DIR = resolve(currentDir, '../../test/fixtures');

describe('S3FileStorage', () => {
  let storage: S3FileStorage;
  let minioStarted = false;

  before(async () => {
    // Only start the MinIO server in record mode
    if (RECORD_MODE === 'record') {
      await startMinioServer();
      await createBucket(TEST_BUCKET);
      minioStarted = true;
    }

    // Create test storage client connected to MinIO
    storage = new S3FileStorage({
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      region: 'us-east-1',
      bucket: TEST_BUCKET,
      endpoint: S3_ENDPOINT,
      forcePathStyle: true,
    });
  });

  after(async () => {
    if (minioStarted) {
      await stopMinioServer();
      await clearAllMinioData();
    }
  });

  afterEach(async () => {
    // Reset global fetch after each test
    resetGlobalFetch();

    // Only remove files in record mode
    if (RECORD_MODE === 'record') {
      const objects = await storage.list();
      for (const object of objects.files) {
        await storage.remove(object.key);
      }
    }
  });

  it('stores and retrieves files', async () => {
    // Override global fetch with record or playback mode
    await overrideGlobalFetch(S3_ENDPOINT, {
      mode: RECORD_MODE,
      recordingFilePath: join(FIXTURES_DIR, 'stores_and_retrieves_files.json'),
    });

    const lastModified = new Date('1999-12-31T23:59:59Z').getTime();
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
    // Override global fetch with record or playback mode
    await overrideGlobalFetch(S3_ENDPOINT, {
      mode: RECORD_MODE,
      recordingFilePath: join(FIXTURES_DIR, 'lists_files_with_pagination.json'),
    });

    const allKeys = ['a', 'b', 'c', 'd', 'e'];
    
    for (const key of allKeys) {
      await storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' }));
    }

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
    // Override global fetch with record or playback mode
    await overrideGlobalFetch(S3_ENDPOINT, {
      mode: RECORD_MODE,
      recordingFilePath: join(FIXTURES_DIR, 'lists_files_by_key_prefix.json'),
    });

    // a limitation of minio (not s3) is objects can't collide with prefixes, so b must be b.ext
    // https://min.io/docs/minio/linux/operations/concepts/thresholds.html#conflicting-objects
    const allKeys = ['a', 'b.ext', 'b/c', 'd', 'e'];

    for (const key of allKeys) {
      await storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' }));
    }

    const { cursor, files } = await storage.list({ prefix: 'b' });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((f) => f.key).sort(), ['b.ext', 'b/c']);
  });

  it('lists files with metadata', async () => {
    // Override global fetch with record or playback mode
    await overrideGlobalFetch(S3_ENDPOINT, {
      mode: RECORD_MODE,
      recordingFilePath: join(FIXTURES_DIR, 'lists_files_with_metadata.json'),
    });

    const allKeys = ['a', 'b', 'c', 'd', 'e'];

    for (const key of allKeys) {
      await storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' }));
    }

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
    // Override global fetch with record or playback mode
    await overrideGlobalFetch(S3_ENDPOINT, {
      mode: RECORD_MODE,
      recordingFilePath: join(FIXTURES_DIR, 'handles_race_conditions.json'),
    });

    const lastModified = new Date('1999-12-31T23:59:59Z').getTime();

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
      // Override global fetch with record or playback mode
      await overrideGlobalFetch(S3_ENDPOINT, {
        mode: RECORD_MODE,
        recordingFilePath: join(FIXTURES_DIR, 'stores_and_lists_file_uploads.json'),
      });

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
