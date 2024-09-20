import fsp from 'node:fs/promises';
import path from 'node:path';

import { writeFile } from '@mjackson/lazy-file/fs';

export interface FileMetadata {
  file: string;
  name: string;
  type: string;
  mtime: number;
}

function randomFilename(): string {
  return `${new Date().getTime().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
}

export async function storeFile(dirname: string, file: File): Promise<string> {
  let filename = randomFilename();

  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(path.join(dirname, filename), 'w');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // Try again with a different filename
      return storeFile(dirname, file);
    } else {
      throw error;
    }
  }

  await writeFile(handle, file);

  return filename;
}

export function isNoEntityError(obj: unknown): obj is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return obj instanceof Error && 'code' in obj && (obj as NodeJS.ErrnoException).code === 'ENOENT';
}
