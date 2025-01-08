import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { openFile, writeFile } from '@mjackson/lazy-file/fs';
import * as crypto from 'node:crypto';

import { type FileStorage } from './file-storage.ts';

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
  }

  async has(key: string): Promise<boolean> {
    let { metaPath } = this.#getFilePaths(key);
    try {
      await fsp.access(metaPath);
      return true;
    } catch {
      return false;
    }
  }

  async set(key: string, file: File): Promise<void> {
    // Remove any existing file with the same key.
    await this.remove(key);

    let { directory, filePath, metaPath } = this.#getFilePaths(key);

    // Ensure directory exists
    await fsp.mkdir(directory, { recursive: true });

    let handle = await fsp.open(filePath, 'w');
    await writeFile(handle, file);

    let metadata: FileMetadata = {
      name: file.name,
      type: file.type,
      mtime: file.lastModified,
    };
    await fsp.writeFile(metaPath, JSON.stringify(metadata));
  }

  async get(key: string): Promise<File | null> {
    let { filePath, metaPath } = this.#getFilePaths(key);

    try {
      let metadataContent = await fsp.readFile(metaPath, 'utf-8');
      let metadata: FileMetadata = JSON.parse(metadataContent);

      return openFile(filePath, {
        name: metadata.name,
        type: metadata.type,
        lastModified: metadata.mtime,
      });
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    let { filePath, metaPath } = this.#getFilePaths(key);

    try {
      await Promise.all([fsp.unlink(filePath), fsp.unlink(metaPath)]);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }
  }

  #getFilePaths(key: string): { directory: string; filePath: string; metaPath: string } {
    let hash = crypto.createHash('sha256').update(key).digest('hex');
    let shardDir = hash.slice(0, 8);
    let directory = path.join(this.#dirname, shardDir);
    let filename = `${hash}.bin`;
    let metaname = `${hash}.meta.json`;

    return {
      directory,
      filePath: path.join(directory, filename),
      metaPath: path.join(directory, metaname),
    };
  }
}

interface FileMetadata {
  name: string;
  type: string;
  mtime: number;
}

function isNoEntityError(obj: unknown): obj is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return obj instanceof Error && 'code' in obj && (obj as NodeJS.ErrnoException).code === 'ENOENT';
}
