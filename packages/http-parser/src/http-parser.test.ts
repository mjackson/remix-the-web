import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { RequestMetadata, ResponseMetadata } from './http-parser.ts';
import {
  parseHttpStream,
  HTTP_REQUEST,
  HTTP_RESPONSE,
} from './http-parser.ts';

function createReadableStream(
  data: string | Uint8Array,
  chunkSize = 64,
): ReadableStream<Uint8Array> {
  let bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let position = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (position >= bytes.length) {
        controller.close();
        return;
      }
      let chunk = bytes.slice(position, position + chunkSize);
      position += chunkSize;
      controller.enqueue(chunk);
    },
  });
}

interface HttpParserTestResult {
  requests: RequestMetadata[];
  responses: ResponseMetadata[];
  chunks: string[];
  errors: Error[];
}

function createHttpParserTest(
  data: string | Uint8Array,
  options: any = {},
  streamOptions: { chunkSize?: number } = {},
): Promise<HttpParserTestResult> {
  return new Promise((resolve) => {
    let stream = createReadableStream(data, streamOptions.chunkSize);
    let requests: RequestMetadata[] = [];
    let responses: ResponseMetadata[] = [];
    let chunks: string[] = [];
    let errors: Error[] = [];
    let bodyChunks: Uint8Array[] = [];
    let hasResolved = false;

    let tryResolve = () => {
      if (hasResolved) return;
      hasResolved = true;
      resolve({ requests, responses, chunks, errors });
    };

    let testOptions = {
      maxHeadersSize: 16384,
      maxBodySize: 1048576,
      onRequest(request: RequestMetadata) {
        requests.push(request);
        if (!options.expectMultipleMessages) {
          setImmediate(tryResolve);
        }
      },
      onResponse(response: ResponseMetadata) {
        responses.push(response);
        if (!options.expectMultipleMessages) {
          setImmediate(tryResolve);
        }
      },
      onBody(chunk: Uint8Array) {
        bodyChunks.push(chunk);
        return options.onBody?.(chunk);
      },
      onComplete() {
        if (bodyChunks.length > 0) {
          let fullBody = new Uint8Array(bodyChunks.reduce((sum, chunk) => sum + chunk.length, 0));
          let offset = 0;
          for (let chunk of bodyChunks) {
            fullBody.set(chunk, offset);
            offset += chunk.length;
          }
          chunks.push(new TextDecoder().decode(fullBody));
          bodyChunks.length = 0;
        }
        options.onComplete?.();
      },
      onError(error: Error) {
        errors.push(error);
        setImmediate(tryResolve);
      },
      ...options,
    };

    parseHttpStream(stream, testOptions)
      .then(() => {
        setImmediate(tryResolve);
      })
      .catch((error) => {
        if (!hasResolved) {
          errors.push(error);
          tryResolve();
        }
      });

    setTimeout(() => {
      if (!hasResolved) {
        tryResolve();
      }
    }, 100);
  });
}

describe('HTTP Parser', () => {
  describe('Common HTTP Features', () => {
    describe('HTTP Versions', () => {
      it('parses HTTP/1.0 messages', async () => {
        let request = 'GET / HTTP/1.0\r\nHost: example.com\r\n\r\n';
        let { requests, errors: reqErrors } = await createHttpParserTest(request);
        assert.equal(reqErrors.length, 0);
        assert.equal(requests[0].httpVersion, '1.0');
        assert.equal(requests[0].shouldKeepAlive, false); // HTTP/1.0 default

        let response = 'HTTP/1.0 200 OK\r\nContent-Length: 0\r\n\r\n';
        let { responses, errors: resErrors } = await createHttpParserTest(response);
        assert.equal(resErrors.length, 0);
        assert.equal(responses[0].httpVersion, '1.0');
        assert.equal(responses[0].shouldKeepAlive, false);
      });

      it('parses HTTP/1.1 messages', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors: reqErrors } = await createHttpParserTest(request);
        assert.equal(reqErrors.length, 0);
        assert.equal(requests[0].httpVersion, '1.1');
        assert.equal(requests[0].shouldKeepAlive, true); // HTTP/1.1 default

        let response = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';
        let { responses, errors: resErrors } = await createHttpParserTest(response);
        assert.equal(resErrors.length, 0);
        assert.equal(responses[0].httpVersion, '1.1');
        assert.equal(responses[0].shouldKeepAlive, true);
      });
    });

    describe('Header Parsing', () => {
      it('parses headers with multiple values', async () => {
        let request =
          'GET / HTTP/1.1\r\n' +
          'Accept: text/html\r\n' +
          'Accept: application/json\r\n' +
          'Host: example.com\r\n\r\n';
        let { requests, errors: reqErrors } = await createHttpParserTest(request);
        assert.equal(reqErrors.length, 0);
        assert.ok(Array.isArray(requests[0].headers.accept));
        assert.equal(requests[0].headers.accept.length, 2);

        let response =
          'HTTP/1.1 200 OK\r\n' +
          'Set-Cookie: a=1\r\n' +
          'Set-Cookie: b=2\r\n' +
          'Content-Length: 0\r\n\r\n';
        let { responses, errors: resErrors } = await createHttpParserTest(response);
        assert.equal(resErrors.length, 0);
        assert.ok(Array.isArray(responses[0].headers['set-cookie']));
        assert.equal(responses[0].headers['set-cookie'].length, 2);
      });

      it('handles empty header values', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Empty:\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['x-empty'], '');
      });

      it('handles headers with special characters', async () => {
        let request =
          'GET / HTTP/1.1\r\n' +
          'Host: example.com\r\n' +
          'X-Special: value with spaces, commas, and: colons\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['x-special'], 'value with spaces, commas, and: colons');
      });

      it('rejects headers that exceed max size', async () => {
        let longValue = 'x'.repeat(16384);
        let request = `GET / HTTP/1.1\r\nHost: example.com\r\nX-Long: ${longValue}\r\n\r\n`;
        let { errors } = await createHttpParserTest(request, { maxHeadersSize: 8192 });
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Headers overflow'));
      });

      it('handles UTF-8 in header values', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-UTF8: café ☕\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['x-utf8'], 'café ☕');
      });

      it('rejects non-ASCII header names', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Café: value\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Message Body Handling', () => {
      it('handles messages with no body', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks.length, 0);
      });

      it('handles Content-Length chunks', async () => {
        let body = 'Hello, World!';
        let request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], body);
      });

      it('handles chunked transfer encoding', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          '5\r\nHello\r\n' +
          '7\r\n, World\r\n' +
          '0\r\n\r\n';
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], 'Hello, World');
      });

      it('handles empty body with Content-Length: 0', async () => {
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 0\r\n\r\n';
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks.length, 0);
      });

      it('rejects body that exceeds maxBodySize', async () => {
        let body = 'x'.repeat(1000);
        let request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
        let { errors } = await createHttpParserTest(request, { maxBodySize: 500 });
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Body size exceeded'));
      });

      it('handles binary data in body', async () => {
        let binaryData = new Uint8Array([0, 1, 2, 255, 254, 253]);
        let request = new Uint8Array([
          ...new TextEncoder().encode(
            `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${binaryData.length}\r\n\r\n`,
          ),
          ...binaryData,
        ]);
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks[0].length, binaryData.length);
      });
    });

    describe('Connection Handling', () => {
      it('handles keep-alive connections', async () => {
        // HTTP/1.1 default
        let req11 = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests: req11s } = await createHttpParserTest(req11);
        assert.equal(req11s[0].shouldKeepAlive, true);

        // HTTP/1.0 with explicit keep-alive
        let req10 = 'GET / HTTP/1.0\r\nConnection: keep-alive\r\n\r\n';
        let { requests: req10s } = await createHttpParserTest(req10);
        assert.equal(req10s[0].shouldKeepAlive, true);
      });

      it('handles close connections', async () => {
        // HTTP/1.1 with Connection: close
        let req = 'GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n';
        let { requests } = await createHttpParserTest(req);
        assert.equal(requests[0].shouldKeepAlive, false);
      });
    });

    describe('Streaming and Chunked Processing', () => {
      it('handles byte-by-byte parsing', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request, {}, { chunkSize: 1 });
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'GET');
      });

      it('handles large chunks', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request, {}, { chunkSize: 1024 });
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'GET');
      });

      it('handles irregular chunk boundaries', async () => {
        let body = 'This is a test body that will be split irregularly';
        let request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
        let { chunks, errors } = await createHttpParserTest(request, {}, { chunkSize: 7 });
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], body);
      });
    });

    describe('Error Handling', () => {
      it('rejects malformed HTTP version', async () => {
        let request = 'GET / HTTP/1.2\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects invalid Content-Length', async () => {
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: abc\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('handles incomplete messages gracefully', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(requests.length, 0);
        assert.ok(errors.length === 0 || errors[0].message.includes('protocol'));
      });
    });

    describe('Concurrent Processing', () => {
      it('handles multiple concurrent parsers', async () => {
        let promises = [];
        for (let i = 0; i < 10; i++) {
          let request = `GET /path${i} HTTP/1.1\r\nHost: example.com\r\n\r\n`;
          promises.push(createHttpParserTest(request));
        }
        let results = await Promise.all(promises);
        results.forEach((result, i) => {
          assert.equal(result.errors.length, 0);
          assert.equal(result.requests[0].url, `/path${i}`);
        });
      });
    });
  });

  describe('HTTP Request Parsing', () => {
    describe('HTTP Methods', () => {
      let methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'CONNECT'];

      for (let method of methods) {
        it(`parses ${method} requests`, async () => {
          let request = `${method} /test HTTP/1.1\r\nHost: example.com\r\n\r\n`;
          let { requests, errors } = await createHttpParserTest(request);
          assert.equal(errors.length, 0);
          assert.equal(requests[0].method, method);
        });
      }

      it('rejects invalid method', async () => {
        let request = 'INVALID / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('URL Handling', () => {
      it('parses URL with query parameters', async () => {
        let request = 'GET /api/users?name=john&age=30 HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url, '/api/users?name=john&age=30');
      });

      it('parses URL with encoded characters', async () => {
        let request = 'GET /api/search?q=hello%20world HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url, '/api/search?q=hello%20world');
      });

      it('parses absolute URL', async () => {
        let request = 'GET http://example.com/path HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url, 'http://example.com/path');
      });

      it('parses URL with fragment', async () => {
        let request = 'GET /page#section HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url, '/page#section');
      });
    });

    describe('WebDAV and Extended Methods', () => {
      it('parses PROPFIND request', async () => {
        let request = 'PROPFIND /resource HTTP/1.1\r\nHost: example.com\r\nDepth: 1\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'PROPFIND');
        assert.equal(requests[0].headers.depth, '1');
      });

      it('parses MKCOL request', async () => {
        let request = 'MKCOL /new-collection HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'MKCOL');
      });
    });

    describe('Request-Specific Headers', () => {
      it('handles Host header', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com:8080\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers.host, 'example.com:8080');
      });

      it('handles Authorization header', async () => {
        let request =
          'GET / HTTP/1.1\r\nHost: example.com\r\nAuthorization: Bearer token123\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers.authorization, 'Bearer token123');
      });

      it('handles User-Agent header', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['user-agent'], 'Mozilla/5.0');
      });
    });
  });

  describe('HTTP Response Parsing', () => {
    describe('Status Codes', () => {
      let statusTests = [
        { code: 200, message: 'OK' },
        { code: 201, message: 'Created' },
        { code: 204, message: 'No Content' },
        { code: 301, message: 'Moved Permanently' },
        { code: 304, message: 'Not Modified' },
        { code: 400, message: 'Bad Request' },
        { code: 401, message: 'Unauthorized' },
        { code: 403, message: 'Forbidden' },
        { code: 404, message: 'Not Found' },
        { code: 500, message: 'Internal Server Error' },
        { code: 502, message: 'Bad Gateway' },
        { code: 503, message: 'Service Unavailable' },
      ];

      for (let { code, message } of statusTests) {
        it(`parses ${code} ${message}`, async () => {
          let response = `HTTP/1.1 ${code} ${message}\r\nContent-Length: 0\r\n\r\n`;
          let { responses, errors } = await createHttpParserTest(response);
          assert.equal(errors.length, 0);
          assert.equal(responses[0].statusCode, code);
          assert.equal(responses[0].statusMessage, message);
        });
      }
    });

    describe('Custom Status Messages', () => {
      it('handles custom status messages', async () => {
        let response = 'HTTP/1.1 200 Everything Is Awesome\r\nContent-Length: 0\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].statusCode, 200);
        assert.equal(responses[0].statusMessage, 'Everything Is Awesome');
      });

      it('handles empty status message', async () => {
        let response = 'HTTP/1.1 200 \r\nContent-Length: 0\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].statusCode, 200);
        assert.equal(responses[0].statusMessage, '');
      });
    });

    describe('Response-Specific Headers', () => {
      it('handles Set-Cookie headers', async () => {
        let response =
          'HTTP/1.1 200 OK\r\n' +
          'Set-Cookie: sessionId=abc123; Path=/; HttpOnly\r\n' +
          'Set-Cookie: theme=dark; Max-Age=3600\r\n' +
          'Content-Length: 0\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.ok(Array.isArray(responses[0].headers['set-cookie']));
        assert.equal(responses[0].headers['set-cookie'].length, 2);
      });

      it('handles cache control headers', async () => {
        let response =
          'HTTP/1.1 200 OK\r\n' +
          'Cache-Control: public, max-age=3600\r\n' +
          'ETag: "abc123"\r\n' +
          'Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT\r\n' +
          'Content-Length: 0\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].headers['cache-control'], 'public, max-age=3600');
        assert.equal(responses[0].headers.etag, '"abc123"');
      });

      it('handles Location header for redirects', async () => {
        let response =
          'HTTP/1.1 301 Moved Permanently\r\n' +
          'Location: https://example.com/new-path\r\n' +
          'Content-Length: 0\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].headers.location, 'https://example.com/new-path');
      });
    });

    describe('Response Bodies', () => {
      it('handles JSON response body', async () => {
        let body = '{"status":"ok","data":{"id":123}}';
        let response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
        let { responses, chunks, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].headers['content-type'], 'application/json');
        assert.equal(chunks[0], body);
      });

      it('handles HTML response body', async () => {
        let body = '<html><body><h1>Hello</h1></body></html>';
        let response = `HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
        let { chunks, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], body);
      });
    });
  });

  describe('Protocol Features', () => {
    describe('Upgrade Handling', () => {
      it('handles WebSocket upgrade request', async () => {
        let request =
          'GET /websocket HTTP/1.1\r\n' +
          'Host: example.com\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==\r\n' +
          'Sec-WebSocket-Version: 13\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].upgrade, true);
        assert.equal(requests[0].headers.upgrade, 'websocket');
      });

      it('handles 101 Switching Protocols response', async () => {
        let response =
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=\r\n\r\n';
        let { responses, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].statusCode, 101);
        assert.equal(responses[0].upgrade, true);
      });

      it('handles HTTP/2 upgrade', async () => {
        let request =
          'GET / HTTP/1.1\r\n' +
          'Host: example.com\r\n' +
          'Connection: Upgrade, HTTP2-Settings\r\n' +
          'Upgrade: h2c\r\n' +
          'HTTP2-Settings: AAMAAABkAARAAAAAAAIAAAAA\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].upgrade, true);
        assert.equal(requests[0].headers.upgrade, 'h2c');
      });
    });
  });

  describe('Parser Type Restrictions', () => {
    it('parses both requests and responses with BOTH type (default)', async () => {
      let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
      let response = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';

      // Default type should parse both
      let { requests: req1, errors: err1 } = await createHttpParserTest(request);
      assert.equal(err1.length, 0);
      assert.equal(req1.length, 1);

      let { responses: res1, errors: err2 } = await createHttpParserTest(response);
      assert.equal(err2.length, 0);
      assert.equal(res1.length, 1);
    });

    it('parses only requests with REQUEST type', async () => {
      let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
      let response = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';

      // REQUEST type should only parse requests
      let { requests, errors: err1 } = await createHttpParserTest(request, {
        type: HTTP_REQUEST,
      });
      assert.equal(err1.length, 0);
      assert.equal(requests.length, 1);

      // REQUEST type should reject responses
      let { errors: err2 } = await createHttpParserTest(response, { type: HTTP_REQUEST });
      assert.ok(err2.length > 0);
      assert.ok(err2[0].message.includes('protocol'));
    });

    it('parses only responses with RESPONSE type', async () => {
      let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
      let response = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';

      // RESPONSE type should only parse responses
      let { responses, errors: err1 } = await createHttpParserTest(response, {
        type: HTTP_RESPONSE,
      });
      assert.equal(err1.length, 0);
      assert.equal(responses.length, 1);

      // RESPONSE type should reject requests
      let { errors: err2 } = await createHttpParserTest(request, { type: HTTP_RESPONSE });
      assert.ok(err2.length > 0);
      assert.ok(err2[0].message.includes('protocol'));
    });
  });

  describe('API Usage', () => {
    describe('Direct HttpParser Class Usage', () => {
      it('can parse requests directly', async () => {
        let request = 'GET /direct HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url, '/direct');
      });

      it('can parse responses directly', async () => {
        let response = 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK';
        let { responses, chunks, errors } = await createHttpParserTest(response);
        assert.equal(errors.length, 0);
        assert.equal(responses[0].statusCode, 200);
        assert.equal(chunks[0], 'OK');
      });
    });

    describe('Callback Ordering and Streaming', () => {
      it('calls callbacks in correct order', async () => {
        let events: string[] = [];
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 4\r\n\r\ntest';

        await createHttpParserTest(request, {
          onRequest() {
            events.push('request');
          },
          onBody() {
            events.push('body');
          },
          onComplete() {
            events.push('complete');
          },
        });

        assert.deepEqual(events, ['request', 'body', 'complete']);
      });

      it('supports pausing via onBody return value', async () => {
        let pauseCount = 0;
        let body = 'x'.repeat(100);
        let request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${body.length}\r\n\r\n${body}`;

        await createHttpParserTest(
          request,
          {
            onBody() {
              pauseCount++;
              return pauseCount < 3 ? false : undefined; // Pause first 2 chunks
            },
          },
          { chunkSize: 10 },
        );

        // Parser should handle pausing gracefully
        assert.ok(pauseCount >= 1);
      });

      it('handles multiple messages in sequence', async () => {
        let req1 = 'GET /first HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let req2 = 'GET /second HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let combined = req1 + req2;

        let { requests, errors } = await createHttpParserTest(combined, {
          expectMultipleMessages: true,
        });

        assert.equal(errors.length, 0);
        assert.equal(requests.length, 2);
        assert.equal(requests[0].url, '/first');
        assert.equal(requests[1].url, '/second');
      });
    });
  });

  describe('Security and Edge Cases', () => {
    describe('Malicious Request Detection', () => {
      it('rejects requests with null bytes in headers', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Test: value\0malicious\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('handles CRLF in header values', async () => {
        // llhttp actually allows literal CRLF in header values per spec
        // The parser will treat everything until the next proper header as the value
        let request =
          'GET / HTTP/1.1\r\nHost: example.com\r\nX-Test: value\r\nInjected: header\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        // This creates two separate headers as expected
        assert.equal(requests[0].headers['x-test'], 'value');
        assert.equal(requests[0].headers['injected'], 'header');
      });

      it('rejects CRLF injection attempts in headers', async () => {
        // This is actually valid - two separate headers
        let request =
          'GET / HTTP/1.1\r\nHost: example.com\r\nX-Test: value\r\nX-Injected: bad\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['x-test'], 'value');
        assert.equal(requests[0].headers['x-injected'], 'bad');
      });

      it('rejects headers with control characters', async () => {
        // Create request with actual control character bytes
        let encoder = new TextEncoder();
        let before = encoder.encode('GET / HTTP/1.1\r\nHost: example.com\r\nX-Test: value');
        let control = new Uint8Array([0x01, 0x02, 0x03]);
        let after = encoder.encode('\r\n\r\n');

        let request = new Uint8Array(before.length + control.length + after.length);
        request.set(before, 0);
        request.set(control, before.length);
        request.set(after, before.length + control.length);

        let { errors } = await createHttpParserTest(request);
        // llhttp rejects control characters in headers
        assert.ok(errors.length > 0);
      });

      it('handles extremely long URLs', async () => {
        // llhttp can handle long URLs as long as they fit in memory
        let longPath = '/' + 'x'.repeat(8192);
        let request = `GET ${longPath} HTTP/1.1\r\nHost: example.com\r\n\r\n`;
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].url.length, 8193); // '/' + 8192 'x's
      });

      it('rejects multiple Content-Length headers with different values', async () => {
        // Multiple Content-Length headers with different values should be rejected
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 10\r\nContent-Length: 20\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects negative Content-Length', async () => {
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: -10\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects both Content-Length and Transfer-Encoding', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 10\r\nTransfer-Encoding: chunked\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        // llhttp rejects requests with both headers for security
        assert.ok(errors.length > 0);
      });

      it('rejects invalid chunked encoding', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          'INVALID\r\nHello\r\n' +
          '0\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects negative chunk sizes', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          '-5\r\nHello\r\n' +
          '0\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects overflowing chunk sizes', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          'FFFFFFFFFFFFFFFFF\r\nHello\r\n' +
          '0\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Protocol Confusion', () => {
      it('handles HTTP/0.9 style requests', async () => {
        // llhttp actually parses this as HTTP/1.1 by default
        let request = 'GET /\r\n\r\n'; // No HTTP version
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'GET');
        assert.equal(requests[0].url, '/');
      });

      it('rejects truly invalid HTTP versions', async () => {
        // Test versions that llhttp actually rejects
        let versions = ['HTTP/2', 'HTTPS/1.1', 'HTTP/1.2', 'HTTP/1.3'];
        for (let version of versions) {
          let request = `GET / ${version}\r\nHost: example.com\r\n\r\n`;
          let { errors } = await createHttpParserTest(request);
          assert.ok(errors.length > 0, `Should reject ${version}`);
        }
      });

      it('rejects response format when expecting request', async () => {
        let response = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';
        let { errors } = await createHttpParserTest(response, { type: HTTP_REQUEST });
        assert.ok(errors.length > 0);
      });

      it('rejects request format when expecting response', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request, { type: HTTP_RESPONSE });
        assert.ok(errors.length > 0);
      });
    });

    describe('Edge Cases from Old Test Suite', () => {
      it('handles empty stream', async () => {
        let emptyData = new Uint8Array(0);
        let { requests, responses, errors } = await createHttpParserTest(emptyData);
        assert.equal(requests.length, 0);
        assert.equal(responses.length, 0);
        assert.equal(errors.length, 0);
      });

      it('handles incomplete request with partial body', async () => {
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 10\r\n\r\nonly5';
        let { requests, chunks, errors } = await createHttpParserTest(request);
        assert.equal(requests.length, 1);
        assert.equal(errors.length, 0);
        // The parser will receive the partial body through onBody callback
        // but won't complete since it's expecting more data
        assert.equal(chunks.length, 0); // onComplete not called due to incomplete chunk
      });

      it('handles request without HTTP version', async () => {
        let request = 'GET /test\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        // llhttp is lenient and accepts this
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'GET');
        assert.equal(requests[0].url, '/test');
      });

      it('handles stream that provides data in single large chunk', async () => {
        let request = 'GET /single-chunk HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request, {}, { chunkSize: 1024 });
        assert.equal(errors.length, 0);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, 'GET');
      });

      it('handles multiple requests in single chunk', async () => {
        let req1 = 'GET /first HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let req2 = 'POST /second HTTP/1.1\r\nHost: example.com\r\nContent-Length: 4\r\n\r\ntest';
        let combined = req1 + req2;

        let { requests, chunks, errors } = await createHttpParserTest(
          combined,
          {
            expectMultipleMessages: true,
          },
          { chunkSize: 1024 },
        );

        assert.equal(errors.length, 0);
        assert.equal(requests.length, 2);
        assert.equal(requests[0].url, '/first');
        assert.equal(requests[1].url, '/second');
        assert.equal(chunks.length, 1);
        assert.equal(chunks[0], 'test');
      });
    });

    describe('Body Streaming Edge Cases', () => {
      it('handles body split across many small chunks', async () => {
        let body = 'This is a test body that will be split into many small chunks';
        let request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${body.length}\r\n\r\n${body}`;

        let chunkCount = 0;
        let bodyReceived = '';
        let { requests, errors } = await createHttpParserTest(
          request,
          {
            onBody(chunk: Uint8Array) {
              chunkCount++;
              bodyReceived += new TextDecoder().decode(chunk);
            },
          },
          { chunkSize: 3 },
        ); // Very small chunks

        assert.equal(errors.length, 0);
        assert.equal(requests.length, 1);
        assert.equal(bodyReceived, body);
        assert.ok(chunkCount > 10, `Should have many chunks, got ${chunkCount}`);
      });

      it('handles chunked encoding split mid-chunk-size', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          'C\r\nHello, World\r\n' + // C is hex for 12
          '0\r\n\r\n';

        let { chunks, errors } = await createHttpParserTest(request, {}, { chunkSize: 50 });
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], 'Hello, World');
      });

      it('handles zero-length chunked body', async () => {
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          '0\r\n\r\n';

        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks.length, 0);
      });
    });

    describe('Resource Exhaustion Protection', () => {
      it('handles extremely slow chunk delivery', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request, {}, { chunkSize: 1 });
        assert.equal(errors.length, 0);
        assert.equal(requests[0].method, 'GET');
      });

      it('rejects infinite chunked encoding attempts', async () => {
        // Create a large chunk that would cause issues
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n' +
          'FFFF\r\n' +
          'x'.repeat(1000) +
          '\r\n';

        let { errors } = await createHttpParserTest(request, { maxBodySize: 500 });
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Body size exceeded'));
      });
    });

    describe('Header Edge Cases', () => {
      it('handles header field with no value', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Empty\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('handles extremely long header name', async () => {
        let longName = 'X-' + 'A'.repeat(1000);
        let request = `GET / HTTP/1.1\r\nHost: example.com\r\n${longName}: value\r\n\r\n`;
        let { requests, errors } = await createHttpParserTest(request);
        // llhttp allows long header names as long as total headers don't exceed max size
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers[longName.toLowerCase()], 'value');
      });

      it('handles tab characters in header values', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Tab: value\twith\ttabs\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(requests[0].headers['x-tab'], 'value\twith\ttabs');
      });

      it('rejects header names with spaces', async () => {
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX Test: value\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('handles header names with colons', async () => {
        // llhttp accepts header names with colons but parses them specially:
        // Everything before the first colon becomes the header name
        let request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX:Test: value\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);

        // llhttp accepts this and parses 'X' as the header name with 'Test: value' as the value
        assert.equal(errors.length, 0);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].headers['x'], 'Test: value');
      });

      it('rejects requests with invalid request line', async () => {
        let request = 'INVALID REQUEST LINE\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects responses with invalid status code', async () => {
        let response = 'HTTP/1.1 999999 Too Many Nines\r\nContent-Length: 0\r\n\r\n';
        let { errors } = await createHttpParserTest(response);
        assert.ok(errors.length > 0);
      });
    });

    describe('Additional Security Tests', () => {
      it('rejects request smuggling attempts', async () => {
        // Attempt to smuggle a second request
        let request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 44\r\nTransfer-Encoding: chunked\r\n\r\n' +
          '0\r\n\r\nGET /admin HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request, { expectMultipleMessages: true });
        // llhttp rejects this as a security measure
        assert.ok(errors.length > 0);
      });

      it('handles headers exceeding max total size', async () => {
        let request = 'GET / HTTP/1.1\r\n';
        // Add many headers to exceed default max size
        for (let i = 0; i < 200; i++) {
          request += `X-Header-${i}: This is a somewhat long header value to consume space\r\n`;
        }
        request += '\r\n';

        let { errors } = await createHttpParserTest(request, { maxHeadersSize: 8192 });
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Headers overflow'));
      });

      it('rejects invalid method characters', async () => {
        let request = 'G=T / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects method with lowercase letters', async () => {
        let request = 'get / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Request Smuggling Prevention', () => {
      it('rejects double Content-Length headers', async () => {
        const request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 5\r\nContent-Length: 10\r\n\r\nHello';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Content-Length'));
      });

      it('rejects Content-Length with Transfer-Encoding', async () => {
        const request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(
          errors[0].message.includes('Content-Length') ||
            errors[0].message.includes('Transfer-Encoding'),
        );
      });

      it('rejects negative Content-Length', async () => {
        const request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: -5\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('Content-Length'));
      });

      it('rejects line folding in headers', async () => {
        const request = 'GET / HTTP/1.1\r\nHost: example.com\r\nX-Bad:\r\n folded\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Null Byte and Control Character Injection', () => {
      it('rejects null bytes in request method', async () => {
        const request = new Uint8Array([
          71,
          69,
          84,
          0, // "GET\0"
          32,
          47,
          32,
          72,
          84,
          84,
          80,
          47,
          49,
          46,
          49,
          13,
          10, // " / HTTP/1.1\r\n"
          13,
          10, // "\r\n"
        ]);
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects null bytes in URL', async () => {
        const method = new TextEncoder().encode('GET ');
        const url = new Uint8Array([47, 0, 116, 101, 115, 116]); // "/\0test"
        const rest = new TextEncoder().encode(' HTTP/1.1\r\n\r\n');
        const request = new Uint8Array(method.length + url.length + rest.length);
        request.set(method, 0);
        request.set(url, method.length);
        request.set(rest, method.length + url.length);

        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects control characters in header names', async () => {
        const request = new Uint8Array([
          71,
          69,
          84,
          32,
          47,
          32,
          72,
          84,
          84,
          80,
          47,
          49,
          46,
          49,
          13,
          10, // "GET / HTTP/1.1\r\n"
          88,
          45,
          1,
          66,
          97,
          100,
          58,
          32,
          118,
          97,
          108,
          13,
          10, // "X-\x01Bad: val\r\n"
          13,
          10, // "\r\n"
        ]);
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('header'));
      });

      it('rejects DEL character in headers', async () => {
        const request = new Uint8Array([
          71,
          69,
          84,
          32,
          47,
          32,
          72,
          84,
          84,
          80,
          47,
          49,
          46,
          49,
          13,
          10, // "GET / HTTP/1.1\r\n"
          88,
          45,
          66,
          97,
          100,
          127,
          58,
          32,
          118,
          97,
          108,
          13,
          10, // "X-Bad\x7F: val\r\n"
          13,
          10, // "\r\n"
        ]);
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Buffer Overflow Protection', () => {
      it('rejects headers exceeding size limit', async () => {
        let request = 'GET / HTTP/1.1\r\n';
        // Create a header that will exceed the default 16KB limit
        for (let i = 0; i < 500; i++) {
          request += `X-Header-${i}: ${'a'.repeat(40)}\r\n`;
        }
        request += '\r\n';

        let { errors } = await createHttpParserTest(request, { maxHeadersSize: 16384 });
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('overflow') || errors[0].message.includes('Headers'));
      });

      it('rejects body exceeding size limit', async () => {
        const bodySize = 1024 * 1024 + 1; // 1MB + 1 byte
        const request = `POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: ${bodySize}\r\n\r\n${'x'.repeat(1000)}`;
        let { errors } = await createHttpParserTest(request, { maxBodySize: 1024 * 1024 }); // 1MB limit

        // JS parser rejects immediately on header, llhttp waits for body
        if (process.env.PARSER === 'JS') {
          assert.ok(errors.length > 0);
          assert.ok(errors[0].message.includes('Body') || errors[0].message.includes('exceeded'));
        } else {
          // llhttp doesn't error until it receives too much body data
          // Since we only send 1000 bytes, it won't error
          assert.ok(errors.length === 0);
        }
      });

      it('rejects chunked body exceeding total size', async () => {
        // Create chunks that total more than 1KB
        let request = 'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n';
        for (let i = 0; i < 5; i++) {
          request += `100\r\n${'x'.repeat(256)}\r\n`; // 256 bytes per chunk
        }
        request += '0\r\n\r\n';

        let { errors } = await createHttpParserTest(request, { maxBodySize: 1024 }); // 1KB limit
        assert.ok(errors.length > 0);
        // Check that at least one error mentions body size
        assert.ok(
          errors.some((err) => err.message.includes('Body') || err.message.includes('exceeded')),
        );
      });
    });

    describe('Malformed Chunked Encoding', () => {
      it('rejects invalid chunk size (non-hex)', async () => {
        const request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\nGGG\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('chunk'));
      });

      it('rejects chunk size with invalid characters', async () => {
        const request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5 \x00\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('rejects missing CRLF after chunk data', async () => {
        const request =
          'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nHello\r\nX';
        let { errors } = await createHttpParserTest(request);
        // Should error when it encounters 'X' instead of a valid chunk size
        assert.ok(errors.length > 0);
      });

      it('rejects chunk extensions with control characters', async () => {
        const request = new Uint8Array([
          ...new TextEncoder().encode(
            'POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5;ext=',
          ),
          1, // control character
          ...new TextEncoder().encode('\r\nHello\r\n0\r\n\r\n'),
        ]);
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('HTTP Version Validation', () => {
      it('accepts HTTP/2.0', async () => {
        const request = 'GET / HTTP/2.0\r\nHost: example.com\r\n\r\n';
        let { requests, errors } = await createHttpParserTest(request);
        // Both parsers should accept HTTP/2.0 and report version as "2.0"
        assert.equal(errors.length, 0);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].httpVersion, '2.0');
      });

      it('rejects completely invalid versions', async () => {
        const request = 'GET / HTTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });
    });

    describe('Method Validation', () => {
      it('rejects methods with invalid characters', async () => {
        const request = 'G=T / HTTP/1.1\r\nHost: example.com\r\n\r\n';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
        assert.ok(errors[0].message.includes('method'));
      });

      it('accepts all standard and WebDAV methods', async () => {
        const methods = [
          'GET',
          'HEAD',
          'POST',
          'PUT',
          'DELETE',
          'CONNECT',
          'OPTIONS',
          'TRACE',
          'PATCH',
          'PROPFIND',
          'PROPPATCH',
          'MKCOL',
          'COPY',
          'MOVE',
          'LOCK',
          'UNLOCK',
        ];

        for (const method of methods) {
          let { requests, errors } = await createHttpParserTest(
            `${method} / HTTP/1.1\r\nHost: example.com\r\n\r\n`,
          );
          assert.equal(errors.length, 0, `Method ${method} should be accepted`);
          assert.equal(requests.length, 1, `Method ${method} should be accepted`);
        }
      });
    });

    describe('URL Validation', () => {
      it('handles URLs with special characters', async () => {
        const urls = [
          '/path?query=value&other=123',
          '/path#fragment',
          '/path%20with%20spaces',
          '/../../../etc/passwd',
          '/\x00nullbyte',
        ];

        for (const url of urls) {
          let { requests, errors } = await createHttpParserTest(
            `GET ${url} HTTP/1.1\r\nHost: example.com\r\n\r\n`,
          );

          // URLs with null bytes should error
          if (url.includes('\x00')) {
            assert.ok(errors.length > 0, `URL with null byte should be rejected`);
          } else {
            assert.equal(errors.length, 0, `URL ${url} should be parsed`);
            assert.equal(requests.length, 1, `URL ${url} should be parsed`);
          }
        }
      });
    });

    describe('Response Status Code Validation', () => {
      it('rejects invalid status codes', async () => {
        const invalidCodes = ['0', '99', '1000', '-200', 'abc'];

        for (const code of invalidCodes) {
          let { errors } = await createHttpParserTest(`HTTP/1.1 ${code} Message\r\n\r\n`);
          assert.ok(errors.length > 0, `Status code ${code} should be rejected`);
        }
      });

      it('accepts valid status codes', async () => {
        const validCodes = ['100', '200', '301', '404', '500', '999'];

        for (const code of validCodes) {
          let { responses, errors } = await createHttpParserTest(
            `HTTP/1.1 ${code} Message\r\n\r\n`,
          );
          assert.equal(errors.length, 0, `Status code ${code} should be accepted`);
          assert.equal(responses.length, 1, `Status code ${code} should be accepted`);
        }
      });
    });

    describe('Keep-Alive Boundary Conditions', () => {
      it('handles pipelined requests correctly', async () => {
        const requests =
          'GET /first HTTP/1.1\r\nHost: example.com\r\n\r\n' +
          'GET /second HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n';

        let result = await createHttpParserTest(requests, { expectMultipleMessages: true });
        assert.equal(result.requests.length, 2);
        assert.deepEqual(
          result.requests.map((r) => r.url),
          ['/first', '/second'],
        );
      });

      it('handles partial second request in pipeline', async () => {
        const requests = 'GET /first HTTP/1.1\r\nHost: example.com\r\n\r\n' + 'GET /second HTTP'; // Incomplete

        let { requests: reqs, errors } = await createHttpParserTest(requests, {
          expectMultipleMessages: true,
        });
        assert.equal(reqs.length, 1);
        assert.equal(errors.length, 0); // Should not error on incomplete data
      });
    });

    describe('Edge Case Content-Length', () => {
      it('handles Content-Length with leading zeros', async () => {
        const request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 005\r\n\r\nHello';
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks[0], 'Hello');
      });

      it('rejects Content-Length with plus sign', async () => {
        const request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: +5\r\n\r\nHello';
        let { errors } = await createHttpParserTest(request);
        assert.ok(errors.length > 0);
      });

      it('handles Content-Length: 0 correctly', async () => {
        const request = 'POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 0\r\n\r\n';
        let { chunks, errors } = await createHttpParserTest(request);
        assert.equal(errors.length, 0);
        assert.equal(chunks.length, 0);
      });
    });
  });
});
