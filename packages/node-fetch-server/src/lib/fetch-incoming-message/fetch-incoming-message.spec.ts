import * as assert from 'node:assert/strict';
import * as http from 'node:http';

import { describe, it, mock } from 'node:test';
import * as stream from 'node:stream';

import { FetchIncomingMessage } from './index.js';

async function parseRequest(httpMessage: string) {
  return new Promise<FetchIncomingMessage>((resolve, reject) => {
    // @ts-expect-error
    const server = http.createServer<FetchIncomingMessage>(
      { IncomingMessage: FetchIncomingMessage },
      async (req: FetchIncomingMessage, res: any) => {
        resolve(req);
      },
    );

    server.on('error', reject);

    // server.emit('listening');

    // Create a mock socket using PassThrough
    const mockSocket = new stream.PassThrough();

    // inject request
    server.emit('connection', mockSocket);
    mockSocket.push(httpMessage, 'utf8');
    mockSocket.push(null); // End the stream
  });
}

describe('FetchIncomingMessage', () => {
  it('should parse POST request', async () => {
    await new Promise<void>(async (resolve) => {
      const body = 'name=FirstName%20LastName&email=user%40example.com';
      const rawRequest = [
        'POST /users HTTP/1.1',
        'Host: example.com',
        'Content-Type: application/x-www-form-urlencoded; charset=custom',
        'Content-Length: 50',
        '',
        body,
        '',
        '',
      ].join('\r\n');

      const req = await parseRequest(rawRequest);

      // do we have a request object?
      assert.ok(req);

      // did we get the method?
      assert.equal(req.method, 'POST');

      // did we get the HTTP version?
      assert.equal(req.httpVersion, '1.1');
      assert.equal(req.httpVersionMajor, 1);
      assert.equal(req.httpVersionMinor, 1);

      // check headers
      assert.equal(req.headers.host, 'example.com');
      assert.equal(req.headers.contentLength, 50);

      // the content type header has multiple parts
      assert.equal(req.headers.contentType.mediaType, 'application/x-www-form-urlencoded');
      assert.equal(req.headers.contentType.charset, 'custom');

      // check url
      assert.equal(req.url, 'http://localhost/users');

      // check body
      const inBuffer = Buffer.from(body);

      const arrayBuffer = await req.arrayBuffer();
      const parsedBuffer = Buffer.from(arrayBuffer);

      assert.deepStrictEqual(inBuffer, parsedBuffer);

      resolve();
    });
  });

  it('should implement text method', async () => {
    async () => {
      await new Promise<void>(async (resolve) => {
        const body = 'name=FirstName%20LastName&email=user%40example.com';
        const rawRequest = [
          'POST /users HTTP/1.1',
          'Host: example.com',
          'Content-Type: application/x-www-form-urlencoded; charset=custom',
          'Content-Length: 50',
          '',
          body,
          '',
          '',
        ].join('\r\n');

        const req = await parseRequest(rawRequest);
        assert.ok(req);

        const text = await req.text();
        assert.equal(text, body);

        resolve();
      });
    };
  });

  it('should implement json method', async () => {
    async () => {
      await new Promise<void>(async (resolve) => {
        const body = '{"foo": "bar"}';
        const rawRequest = [
          'POST /users HTTP/1.1',
          'Host: example.com',
          'Content-Type: application/json',
          'Content-Length: 50',
          '',
          body,
          '',
          '',
        ].join('\r\n');

        const req = await parseRequest(rawRequest);
        assert.ok(req);

        const parsedJson = await req.json<{ foo: string }>();

        assert.ok(parsedJson);

        assert.equal(typeof parsedJson, 'object');
        assert.equal('foo' in parsedJson, true);
        assert.equal(parsedJson.foo, 'bar');

        resolve();
      });
    };
  });

  it('should throw error for unimplemented clone method', async () => {
    await new Promise<void>(async (resolve) => {
      const body = '{"foo": "bar"}';
      const rawRequest = [
        'POST /users HTTP/1.1',
        'Host: example.com',
        'Content-Type: application/json',
        'Content-Length: 50',
        '',
        body,
        '',
        '',
      ].join('\r\n');

      const req = await parseRequest(rawRequest);
      assert.ok(req);

      assert.throws(() => req.clone(), { message: 'Method not implemented.' });

      resolve();
    });
  });

  it('should throw error for unimplemented blob method', async () => {
    await new Promise<void>(async (resolve) => {
      const body = '{"foo": "bar"}';
      const rawRequest = [
        'POST /users HTTP/1.1',
        'Host: example.com',
        'Content-Type: application/json',
        'Content-Length: 50',
        '',
        body,
        '',
        '',
      ].join('\r\n');

      const req = await parseRequest(rawRequest);
      assert.ok(req);

      assert.rejects(() => req.blob(), { message: 'Method not implemented.' });

      resolve();
    });
  });
});
