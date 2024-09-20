import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { openFile, writeFile } from '@mjackson/lazy-file/fs';

import { FileStorage } from './file-storage.js';
import { FileMetadata, isNoEntityError, storeFile } from './utils.js';

/**
 * A `FileStorage` that is backed by the local filesystem.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 */
export class LocalFileStorage implements FileStorage {
  #dirname: string;
  #metadata: FileMetadataIndex;

  /**
   * @param directory The directory where files are stored
   */
  constructor(directory: string) {
    this.#dirname = path.resolve(directory);

    try {
      let stats = fs.statSync(this.#dirname);

      if (!stats.isDirectory()) {
        throw new Error(`Path "${this.#dirname}" is not a directory`);
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      fs.mkdirSync(this.#dirname, { recursive: true });
    }

    this.#metadata = new FileMetadataIndex(path.join(directory, '.metadata.json'));
  }

  has(key: string): Promise<boolean> {
    return this.#metadata.has(key);
  }

  async set(key: string, file: File): Promise<void> {
    // Remove any existing file with the same key.
    await this.remove(key);

    let storedFile = await storeFile(this.#dirname, file);

    await this.#metadata.set(key, {
      file: storedFile,
      name: file.name,
      type: file.type,
      mtime: file.lastModified,
    });
  }

  async get(key: string): Promise<File | null> {
    let metadata = await this.#metadata.get(key);
    if (metadata == null) return null;

    let filename = path.join(this.#dirname, metadata.file);

    return openFile(filename, {
      name: metadata.name,
      type: metadata.type,
      lastModified: metadata.mtime,
    });
  }

  async remove(key: string): Promise<void> {
    let metadata = await this.#metadata.get(key);
    if (metadata == null) return;

    let filename = path.join(this.#dirname, metadata.file);

    try {
      await fsp.unlink(filename);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }

    await this.#metadata.remove(key);
  }
}

class FileMetadataIndex {
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async #getAll(): Promise<Record<string, FileMetadata>> {
    try {
      return JSON.parse(await openFile(this.#path).text());
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      return {};
    }
  }

  async #save(info: Record<string, FileMetadata | undefined>): Promise<void> {
    await fsp.writeFile(this.#path, JSON.stringify(info));
  }

  async has(key: string): Promise<boolean> {
    let info = await this.#getAll();
    return key in info;
  }

  async set(key: string, metadata: FileMetadata): Promise<void> {
    let info = await this.#getAll();
    await this.#save({ ...info, [key]: metadata });
  }

  async get(key: string): Promise<FileMetadata | null> {
    let info = await this.#getAll();
    return info[key] ?? null;
  }

  async remove(key: string): Promise<void> {
    let info = await this.#getAll();
    await this.#save({ ...info, [key]: undefined });
  }
}
