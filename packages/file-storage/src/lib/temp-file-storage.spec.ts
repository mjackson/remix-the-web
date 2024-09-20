import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { TempFileStorage } from './temp-file-storage.js';

describe('TempFileStorage', () => {
  it('stores and retrieves files', async () => {
    await using storage = new TempFileStorage('test-');
    let lastModified = Date.now();
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    });

    await storage.set('hello', file);

    assert.ok(storage.has('hello'));

    let retrieved = storage.get('hello');

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'hello.txt');
    assert.equal(retrieved.type, 'text/plain');
    assert.equal(retrieved.lastModified, lastModified);
    assert.equal(retrieved.size, 13);

    let text = await retrieved.text();

    assert.equal(text, 'Hello, world!');

    await storage.remove('hello');

    assert.ok(!storage.has('hello'));
    assert.equal(storage.get('hello'), null);
  });

  it('only creates dir after set is called and removes the dir on disposal', async () => {
    let dir: string;
    {
      await using storage = new TempFileStorage('test-');
      assert.equal(storage.dirname, undefined);

      await storage.set(
        'hello',
        new File(['Hello, world!'], 'hello.txt', {
          type: 'text/plain',
          lastModified: Date.now(),
        }),
      );

      assert.notEqual(storage.dirname, undefined);
      assert.doesNotThrow(() => fs.accessSync(storage.dirname!));
      dir = storage.dirname!;
    }
    assert.throws(() => fs.accessSync(dir));
  });
});
