import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { describe, it } from 'node:test';
import { TempFileStorage } from './temp-file-storage.js';

async function testStorage(storage: TempFileStorage) {
  assert.equal(storage.dirname, undefined);

  let lastModified = Date.now();
  let file = new File(['Hello, world!'], 'hello.txt', {
    type: 'text/plain',
    lastModified,
  });

  await storage.set('hello', file);

  assert.notEqual(storage.dirname, undefined);
  assert.doesNotThrow(() => fs.accessSync(storage.dirname!));

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

  return storage.dirname!;
}

describe('TempFileStorage', () => {
  it('works with manual cleanup', async () => {
    const storage = new TempFileStorage('test-');

    const dir = await testStorage(storage);

    // Manually clean up the directory
    await storage.destroy();
    assert.throws(() => fs.accessSync(dir));
  });

  it('works when used as an disposable', async () => {
    let dir: string;
    {
      await using storage = new TempFileStorage('test-');
      dir = await testStorage(storage);
    }
    assert.throws(() => fs.accessSync(dir));
  });

  it('works when used with `use`', async () => {
    const dir = await new TempFileStorage('test-').use(testStorage);
    assert.throws(() => fs.accessSync(dir));
  });
});
