import * as assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { LocalFileStorage } from './local-file-storage.ts';
import { FileStorageIterationError } from './file-iterator.ts';

const __dirname = new URL('.', import.meta.url).pathname;

describe('LocalFileStorage', () => {
  let directory = path.resolve(__dirname, '../../test-local-file-storage');

  afterEach(() => {
    fs.rmSync(directory, { recursive: true });
  });

  it('stores and retrieves files', async () => {
    let storage = new LocalFileStorage(directory);
    let lastModified = Date.now();
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    });

    await storage.set('hello', file);

    assert.ok(await storage.has('hello'));

    let retrieved = await storage.get('hello');

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'hello.txt');
    assert.equal(retrieved.type, 'text/plain');
    assert.equal(retrieved.lastModified, lastModified);
    assert.equal(retrieved.size, 13);

    let text = await retrieved.text();

    assert.equal(text, 'Hello, world!');

    await storage.remove('hello');

    assert.ok(!(await storage.has('hello')));
    assert.equal(await storage.get('hello'), null);
  });

  it('lists files with pagination', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list();
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);

    let { cursor: cursor1, files: files1 } = await storage.list({ limit: 0 });
    assert.equal(cursor1, undefined);
    assert.equal(files1.length, 0);

    let { cursor: cursor2, files: files2 } = await storage.list({ limit: 2 });
    assert.notEqual(cursor2, undefined);
    assert.equal(files2.length, 2);

    let { cursor: cursor3, files: files3 } = await storage.list({ cursor: cursor2 });
    assert.equal(cursor3, undefined);
    assert.equal(files3.length, 3);

    assert.deepEqual([...files2, ...files3].map((f) => f.key).sort(), allKeys);
  });

  it('lists files by key prefix', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'b/c', 'c', 'd'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list({ prefix: 'b' });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((f) => f.key).sort(), ['b', 'b/c']);
  });

  it('lists files with metadata', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list({ includeMetadata: true });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);
    files.forEach((f) => assert.ok('lastModified' in f));
    files.forEach((f) => assert.ok('name' in f));
    files.forEach((f) => assert.ok('size' in f));
    files.forEach((f) => assert.ok('type' in f));
  });

  it('supports async iteration over list results', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let result = await storage.list();
    let iteratedKeys = [];
    
    for await (const file of result) {
      iteratedKeys.push(file.key);
    }

    assert.deepEqual(iteratedKeys.sort(), allKeys.sort());
  });

  it('respects limit during async iteration', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `${key}.txt`, { type: 'text/plain' })),
      ),
    );

    let result = await storage.list({ limit: 3 });
    let iteratedKeys = [];
    
    for await (const file of result) {
      iteratedKeys.push(file.key);
    }

    assert.equal(iteratedKeys.length, 3);
    assert.ok(result.cursor !== undefined); // Should have a cursor for pagination
    
    // Get next page
    let nextResult = await storage.list({ cursor: result.cursor });
    let nextKeys = [];
    for await (const file of nextResult) {
      nextKeys.push(file.key);
    }
    
    assert.equal(nextKeys.length, 2); // Should get remaining 2 items
    assert.equal(nextResult.cursor, undefined); // No more pages
  });

  it('supports async iteration with metadata', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c'];
    let lastModified = Date.now();

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, {
          type: 'text/plain',
          lastModified
        })),
      ),
    );

    let result = await storage.list({ includeMetadata: true });
    
    for await (const file of result) {
      assert.ok('lastModified' in file);
      assert.ok('name' in file);
      assert.ok('size' in file);
      assert.ok('type' in file);
      assert.equal(file.name, 'hello.txt');
      assert.equal(file.type, 'text/plain');
      assert.equal(file.lastModified, lastModified);
    }
  });

  it('handles race conditions', async () => {
    let storage = new LocalFileStorage(directory);
    let lastModified = Date.now();

    let file1 = new File(['Hello, world!'], 'hello1.txt', {
      type: 'text/plain',
      lastModified,
    });

    let file2 = new File(['Hello, universe!'], 'hello2.txt', {
      type: 'text/plain',
      lastModified,
    });

    let setPromise = storage.set('one', file1);
    await storage.set('two', file2);

    let retrieved1 = await storage.get('one');
    assert.ok(retrieved1);
    assert.equal(await retrieved1.text(), 'Hello, world!');

    await setPromise;
    let retrieved2 = await storage.get('two');
    assert.ok(retrieved2);
    assert.equal(await retrieved2.text(), 'Hello, universe!');
  });

  describe('iterate', () => {
    it('iterates over all files with default settings', async () => {
      let storage = new LocalFileStorage(directory);
      let allKeys = ['a', 'b', 'c', 'd', 'e'];

      await Promise.all(
        allKeys.map((key) =>
          storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
        ),
      );

      let foundKeys = [];
      for await (const file of storage.iterate()) {
        foundKeys.push(file.key);
      }

      assert.deepEqual(foundKeys.sort(), allKeys.sort());
    });

    it('iterates with metadata', async () => {
      let storage = new LocalFileStorage(directory);
      let allKeys = ['a', 'b', 'c'];
      let lastModified = Date.now();

      await Promise.all(
        allKeys.map((key) =>
          storage.set(key, new File([`Hello ${key}!`], `hello.txt`, {
            type: 'text/plain',
            lastModified
          })),
        ),
      );

      for await (const file of storage.iterate({ includeMetadata: false })) {
        assert.equal('lastModified' in file, false);
        assert.equal('name' in file, false);
        assert.equal('size' in file, false);
        assert.equal('type' in file, false);
      }

      for await (const file of storage.iterate({ includeMetadata: true })) {
        assert.ok('lastModified' in file);
        assert.ok('name' in file);
        assert.ok('size' in file);
        assert.ok('type' in file);
        assert.equal(file.type, 'text/plain');
        assert.equal(file.name, 'hello.txt');
        assert.equal(file.lastModified, lastModified);
      }
    });

    it('iterates with prefix filter', async () => {
      let storage = new LocalFileStorage(directory);
      let allKeys = ['a/1', 'a/2', 'b/1', 'c/1'];

      await Promise.all(
        allKeys.map((key) =>
          storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
        ),
      );

      let foundKeys = [];
      for await (const file of storage.iterate({ prefix: 'a/' })) {
        foundKeys.push(file.key);
      }

      assert.deepEqual(foundKeys.sort(), ['a/1', 'a/2']);
    });

    it('handles abort signal', async () => {
      let storage = new LocalFileStorage(directory);
      let allKeys = Array.from({ length: 10 }, (_, i) => `key${i}`);

      for (const key of allKeys) {
        await storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' }));
      }

      const controller = new AbortController();
      const iterator = storage.iterate({
        pageSize: 2,
        signal: controller.signal
      })[Symbol.asyncIterator]();

      // Get first file
      const firstFile = await iterator.next();
      assert.ok(!firstFile.done);

      // Abort the iteration
      // Whether a second page gets fetched is ambiguous behavior, but a third page will not be fetched
      controller.abort();

      // Get second file - this should always work
      const secondFile = await iterator.next();
      assert.ok(!secondFile.done);

      try {
        // Get third file - this is deliberately ambiguous behavior
        const thirdFile = await iterator.next();
        assert.ok(!thirdFile.done);
        // Get fourth file - this is deliberately ambiguous behavior
        const fourthFile = await iterator.next();
        assert.ok(!fourthFile.done);
        // Get fifth file - this should always fail
        await iterator.next();
        assert.fail('Expected iteration to be aborted after at most 2 pages');
      } catch (error) {
        assert.ok(error instanceof FileStorageIterationError);
        assert.equal(error.message, 'Iteration aborted');
      }
    });
  });
});
