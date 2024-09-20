import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { FileStorage } from './file-storage.js';
import { FileMetadata, isNoEntityError, storeFile } from './utils.js';
import { openFile } from '@mjackson/lazy-file/fs';

type MkdtempOptions = Parameters<typeof fsp.mkdtemp>[1];

/**
 * A lazy `FileStorage` that is backed by a temporary directory on the local
 * filesystem. The temporary directory is only created if `set` is called.
 *
 * This class implements AsyncDisposable and should be used with `await using`,
 * but the `destroy` method is exposed for manual cleanup.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 */
export class TempFileStorage implements FileStorage, AsyncDisposable {
  #mkdir: () => Promise<string>;
  #dirname: string | undefined;
  #metadata = new Map<string, FileMetadata>();

  constructor(prefix: string, options?: MkdtempOptions) {
    this.#mkdir = () => fsp.mkdtemp(path.join(os.tmpdir(), prefix), options);
  }

  get dirname() {
    return this.#dirname;
  }

  has(key: string): boolean {
    return this.#metadata.has(key);
  }

  async set(key: string, file: File): Promise<void> {
    if (!this.#dirname) {
      this.#dirname = await this.#mkdir();
    }

    // Remove any existing file with the same key.
    await this.remove(key);

    let storedFile = await storeFile(this.#dirname, file);

    this.#metadata.set(key, {
      file: storedFile,
      name: file.name,
      type: file.type,
      mtime: file.lastModified,
    });
  }

  get(key: string): File | null {
    let metadata = this.#metadata.get(key);
    if (metadata == null || !this.#dirname) return null;

    let filename = path.join(this.#dirname, metadata.file);

    return openFile(filename, {
      name: metadata.name,
      type: metadata.type,
      lastModified: metadata.mtime,
    });
  }

  async remove(key: string): Promise<void> {
    let metadata = this.#metadata.get(key);
    if (metadata == null || !this.#dirname) return;

    let filename = path.join(this.#dirname, metadata.file);

    try {
      await fsp.unlink(filename);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }

    this.#metadata.delete(key);
  }

  /**
   * Deletes the temporary directory and resets the metadata. Prefer using this
   * class as a disposable with `await using` instead of calling this method.
   */
  async destroy(): Promise<void> {
    if (this.#dirname) {
      await fsp.rm(this.#dirname, { recursive: true, force: true });
      this.#dirname = undefined;
      this.#metadata = new Map();
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }
}
