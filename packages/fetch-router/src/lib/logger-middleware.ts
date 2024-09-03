import { Middleware } from './middleware.js';

export interface LoggerMiddlewareOptions {
  /**
   * The format to use for log messages. Defaults to `[%date] %method %path %status %contentLength`.
   *
   * The following tokens are available:
   *
   * - `%contentLength` - The `Content-Length` header of the response.
   * - `%contentType` - The `Content-Type` header of the response.
   * - `%date` - The date and time of the request as [an ISO string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString).
   * - `%duration` - The duration of the request in milliseconds.
   * - `%host` - The host of the request URL.
   * - `%hostname` - The hostname of the request URL.
   * - `%method` - The method of the request.
   * - `%path` - The pathname + search of the request URL.
   * - `%pathname` - The pathname of the request URL.
   * - `%port` - The port of the request.
   * - `%protocol` - The protocol of the request (e.g. "http:" or "https:").
   * - `%query` - The query (search) string of the request URL.
   * - `%referer` - The `Referer` header of the request.
   * - `%search` - The search string of the request URL.
   * - `%status` - The status code of the response.
   * - `%statusText` - The status text of the response.
   * - `%url` - The full URL of the request.
   * - `%userAgent` - The `User-Agent` header of the request.
   */
  format?: string;
  /**
   * The function to use to log messages. Defaults to `console.log`.
   */
  log?: (message: string) => void;
}

/**
 * Creates a middleware handler that logs various request/response info.
 */
export function loggerMiddleware(options?: LoggerMiddlewareOptions): Middleware {
  let format = options?.format ?? '[%date] %method %path %status %contentLength';
  let log = options?.log ?? console.log;

  return async (request, next) => {
    let start = new Date();
    let response = await next();
    let end = new Date();
    let url = new URL(request.url);

    let message = format.replace(/%(\w+)/g, (_, key) => {
      if (key === 'contentLength') return response.headers.get('Content-Length') ?? '-';
      if (key === 'contentType') return response.headers.get('Content-Type') ?? '-';
      if (key === 'date') return start.toISOString();
      if (key === 'duration') return String(end.getTime() - start.getTime());
      if (key === 'host') return url.host;
      if (key === 'hostname') return url.hostname;
      if (key === 'method') return request.method;
      if (key === 'path') return url.pathname + url.search;
      if (key === 'pathname') return url.pathname;
      if (key === 'port') return url.port;
      if (key === 'protocol') return url.protocol;
      if (key === 'query') return url.search;
      if (key === 'referer') return request.headers.get('Referer') ?? '-';
      if (key === 'search') return url.search;
      if (key === 'status') return String(response.status);
      if (key === 'statusText') return response.statusText;
      if (key === 'url') return request.url;
      if (key === 'userAgent') return request.headers.get('User-Agent') ?? '-';
      return '';
    });

    log(message);
  };
}
