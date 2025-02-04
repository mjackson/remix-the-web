import { openFile } from '@mjackson/lazy-file/fs';

import type { Middleware } from '../middleware.ts';

export interface FaviconMiddlewareOptions {
  /**
   * The `max-age` directive to use in the `Cache-Control` header. Defaults to `0`, which disables
   * the `Cache-Control` header entirely.
   */
  maxAge?: number;
}

/**
 * A middleware that serves a favicon file at the `/favicon.ico` URL.
 * @param file The favicon file to serve, or a path to the favicon file.
 * @param options Options to configure the middleware.
 */
export function faviconMiddleware(
  file: string | File,
  options?: FaviconMiddlewareOptions,
): Middleware {
  if (typeof file === 'string') {
    file = openFile(file);
  }

  let maxAge = options?.maxAge ?? 0;

  return async ({ request }, next) => {
    if (request.url !== '/favicon.ico') {
      return next();
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 });
    }

    let headers = new Headers({
      'Content-Length': file.size.toString(),
      'Content-Type': file.type,
    });

    if (maxAge > 0) {
      headers.set('Cache-Control', `public, max-age=${maxAge}`);
    }

    return new Response(file, { headers });
  };
}
