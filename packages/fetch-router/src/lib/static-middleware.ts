import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { openFile } from '@mjackson/lazy-file/fs';

import { Middleware } from './middleware.js';

interface StaticMiddlewareOptions {
  /**
   * Whether to enable the `immutable` directive in the `Cache-Control` header. Defaults to `false`.
   *
   * If enabled, the `maxAge` option should also be used to enable caching. This directive prevents
   * clients from making conditional requests for the file until the `maxAge` has passed.
   */
  immutable?: boolean;
  /**
   * The maximum age of the file in seconds. This is used to set the `max-age` directive in the
   * `Cache-Control` header. If not provided, the `Cache-Control` header will not be set.
   */
  maxAge?: number;
}

/**
 * A middleware that serves static files from a directory on the file system.
 * @param rootDir The root directory to serve files from.
 * @param options Options to configure the middleware.
 */
export function staticMiddleware(rootDir: string, options?: StaticMiddlewareOptions): Middleware {
  try {
    let stats = fs.statSync(rootDir);

    if (!stats.isDirectory()) {
      throw new Error(`The path "${rootDir}" is not a directory`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`The directory "${rootDir}" does not exist`);
    }

    throw error;
  }

  let immutable = options?.immutable ?? false;
  let maxAge = options?.maxAge ?? 0;

  return async (request, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return next();
    }

    let url = new URL(request.url);
    let filename = path.normalize(path.join(rootDir, ...url.pathname.split('/')));

    if (!filename.startsWith(rootDir + path.sep)) {
      // Do not allow access to files outside of the root directory.
      return next();
    }

    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(path.dirname(filename), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return next();
      }

      throw error;
    }

    let basename = path.basename(filename);
    let entry = entries.find((entry) => entry.name === basename);

    if (entry != null) {
      if (entry.isFile()) {
        return sendFile(request, filename, maxAge, immutable);
      }

      if (entry.isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          // Automatically redirect /public/dir to /public/dir/
          url.pathname += '/';
          return redirectTo(url);
        }

        let files = await fsp.readdir(filename);
        for (let name of ['index.html', 'index.htm']) {
          if (files.includes(name)) {
            return sendFile(request, path.join(filename, name), maxAge, immutable);
          }
        }
      }
    }

    return next();
  };
}

function sendFile(
  request: Request,
  filename: string,
  maxAge: number,
  immutable: boolean,
): Response {
  let file = openFile(filename);
  let etag = `"${file.size.toString(36)}-${file.lastModified.toString(16)}"`;

  let headers = new Headers({
    'Content-Length': file.size.toString(),
    'Content-Type': file.type,
    'Last-Modified': new Date(file.lastModified).toUTCString(),
    ETag: etag,
  });

  if (maxAge > 0) {
    if (immutable) {
      headers.set('Cache-Control', `public, max-age=${maxAge}, immutable`);
    } else {
      headers.set('Cache-Control', `public, max-age=${maxAge}`);
    }
  }

  let ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch != null && ifNoneMatch.includes(etag)) {
    return new Response(null, { status: 304, headers });
  }

  let ifModifiedSince = request.headers.get('If-Modified-Since');
  if (ifModifiedSince != null && new Date(ifModifiedSince).getTime() >= file.lastModified) {
    return new Response(null, { status: 304, headers });
  }

  let ifUnmodifiedSince = request.headers.get('If-Unmodified-Since');
  if (ifUnmodifiedSince != null && new Date(ifUnmodifiedSince).getTime() < file.lastModified) {
    return new Response(null, { status: 412 });
  }

  return new Response(file.stream(), { headers });
}

function redirectTo(url: URL, status = 302): Response {
  let body = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; url=${url}">
  </head>
  <body>
    <p>Redirecting to <a href="${url}">${url}</a>...</p>
  </body>
</html>`;

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'Content-Length': body.length.toString(),
      Location: url.toString(),
    },
  });
}
