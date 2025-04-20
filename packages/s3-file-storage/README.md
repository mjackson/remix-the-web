# s3-file-storage

`s3-file-storage` is a key/value interface for storing [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File) in an S3-compatible object storage service. It provides a simple API for uploading, retrieving, and managing files in S3 buckets.

## Features

- Simple, intuitive key/value API for S3-compatible storage
- Supports large file uploads using S3 multipart upload
- Preserves all `File` metadata including `file.name`, `file.type`, and `file.lastModified`
- Compatible with AWS S3, MinIO, Cloudflare R2, and other S3-compatible services
- Pagination support for listing files

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/s3-file-storage
```

## Usage

```ts
import { S3FileStorage } from '@mjackson/s3-file-storage';

let storage = new S3FileStorage({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  region: 'us-east-1',
  bucket: 'your-bucket-name',
  endpoint: 'https://your-s3-endpoint', // Optional for S3-compatible services
  forcePathStyle: true, // Optional, defaults to false
  eager: false, // Optional, defaults to false. Causes get and put to fetch immediately
});

let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
let key = 'hello-key';

// Put the file in storage.
await storage.set(key, file);

// Then, sometime later...
let fileFromStorage = await storage.get(key);
// All of the original file's metadata is intact
fileFromStorage.name; // 'hello.txt'
fileFromStorage.type; // 'text/plain'

// To remove from storage
await storage.remove(key);
```

The `S3FileStorage` class also supports listing files with optional pagination and metadata:

```ts
// List all files in the bucket
let { files } = await storage.list();
files.forEach((file) => console.log(file.key));

// List files with a prefix
let { files: prefixedFiles } = await storage.list({ prefix: 'folder/' });
prefixedFiles.forEach((file) => console.log(file.key));

// List files with metadata
let { files: filesWithMetadata } = await storage.list({ includeMetadata: true });
filesWithMetadata.forEach((file) => {
  console.log(file.key, file.name, file.size, file.type, file.lastModified);
});
```

## Related Packages

- [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage) - A generic interface for file storage, which `s3-file-storage` implements
- [`lazy-file`](https://github.com/mjackson/remix-the-web/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from S3

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)