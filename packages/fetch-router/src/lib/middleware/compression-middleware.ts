import { Middleware } from '../middleware.ts';

export interface CompressionMiddlewareOptions {
  /**
   * A regular expression that matches the `Content-Type` header of responses that should be
   * compressed. By default, only text-based responses are compressed.
   *
   * Be careful when changing this setting as compressing binary formats such as images, video, and
   * archives can often increase their size.
   */
  filter?: RegExp;
  /**
   * The compression format to use. Defaults to `gzip`.
   */
  format?: 'gzip' | 'deflate' | 'deflate-raw';
  /**
   * The minimum response size in bytes to compress. Responses smaller than this threshold will not
   * be compressed. Defaults to `1024` bytes.
   */
  threshold?: number;
}

/**
 * A middleware that compresses the response body using the specified format. This is commonly used
 * to reduce the size of responses before sending them to the client by applying gzip or deflate
 * compression.
 * @param options Options to configure the middleware.
 */
export function compressionMiddleware(options?: CompressionMiddlewareOptions): Middleware {
  let filter = options?.filter ?? /^text\/|\+(json|text|xml)$/i;
  let format = options?.format ?? 'gzip';
  let threshold = options?.threshold ?? 1024;

  return async (_, next) => {
    let response = await next();

    if (response.body == null) {
      // Nothing to compress.
      return response;
    }

    if (response.headers.has('Content-Encoding')) {
      // We do not support multiple encodings of the same resource.
      return response;
    }

    if (response.status === 206) {
      // We can't compress partial content because the range has already been applied
      // to the uncompressed data.
      return response;
    }

    let contentType = response.headers.get('Content-Type');
    if (contentType != null && !filter.test(contentType)) {
      // Do not compress responses with unsupported content types.
      return response;
    }

    let contentLength = response.headers.get('Content-Length');
    if (contentLength != null && parseInt(contentLength, 10) < threshold) {
      // Do not compress small response bodies.
      return response;
    }

    let headers = new Headers(response.headers);

    headers.set('Content-Encoding', format);

    return new Response(response.body.pipeThrough(new CompressionStream(format)), { headers });
  };
}
