import { chmod, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { AwsClient } from 'aws4fetch';

const __dirname = new URL('.', import.meta.url).pathname;
const MINIO_DIR = resolve(__dirname, '../.minio');
const MINIO_DATA_DIR = resolve(MINIO_DIR, 'data');
const MINIO_BIN_DIR = resolve(MINIO_DIR, 'bin');
const MINIO_BIN_PATH = join(MINIO_BIN_DIR, 'minio');

export const MINIO_PORT = 9000;

const aws = new AwsClient({
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    region: 'us-east-1',
    service: 's3'
});

let minioProcess: ChildProcess;

export async function downloadMinio() {
  const platform = process.platform;
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  await mkdir(MINIO_BIN_DIR, { recursive: true });

  if (!existsSync(MINIO_BIN_PATH)) {
    console.log('Downloading MinIO...');
    const response = await fetch(`https://dl.min.io/server/minio/release/${platform}-${arch}/minio`);
    const buffer = await response.arrayBuffer();
    await writeFile(MINIO_BIN_PATH, Buffer.from(buffer));
    await chmod(MINIO_BIN_PATH, 0o755);
  }

  return MINIO_BIN_PATH;
}

export async function startMinioServer() {
    await downloadMinio();

  // Ensure data directory exists
    await mkdir(MINIO_DATA_DIR, { recursive: true });

  // Start MinIO server with custom port
  minioProcess = spawn(MINIO_BIN_PATH, ['server', '--address', `:${MINIO_PORT}`, MINIO_DATA_DIR], {
    env: {
      ...process.env,
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin'
    }
  });

  // Wait for MinIO to start
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('MinIO server failed to start within timeout'));
    }, 5000);

    minioProcess.stdout?.on('data', (_data: Buffer) => {
      clearTimeout(timeout);
      resolve();
    });

    minioProcess.stderr?.on('data', (_data: Buffer) => {
      clearTimeout(timeout);
      resolve();
    });

    minioProcess.on('error', (err) => {
      console.error(`MinIO process error: ${err}`);
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function stopMinioServer() {
  if (minioProcess) {
    minioProcess.kill();
  }
}

export async function clearAllMinioData() {
  try {
    await rm(MINIO_DATA_DIR, { recursive: true, force: true });
    await mkdir(MINIO_DATA_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error clearing MinIO data directory: ${error}`);
  }
}

// Helper to create an S3 bucket
export async function createBucket(bucketName: string): Promise<void> {
    await aws.fetch(`http://localhost:${MINIO_PORT}/${bucketName}`, {
        method: 'PUT'
    });
}
