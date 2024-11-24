import { Blob } from 'node:buffer';
import type { Socket } from 'node:net';
import { Readable, finished } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import type {
  Request,
  ReferrerPolicy,
  RequestCache,
  RequestCredentials,
  RequestDestination,
  RequestMode,
  RequestRedirect,
} from 'undici-types';
import SuperHeaders from '@mjackson/headers';

import { matchKnownFields, onError } from './utils.js';

export class FetchIncomingMessage extends Readable implements Request {
  public url!: string;
  public method!: string;

  private _headers = new SuperHeaders();

  private _cache!: RequestCache;

  private _integrity!: string;
  private _referrer!: string;
  private _keepalive!: boolean;
  private _signal!: AbortSignal;
  private _body!: ReadableStream<any> | null;
  private _bodyUsed!: boolean;

  credentials!: RequestCredentials;
  destination!: RequestDestination;
  mode!: RequestMode;
  redirect!: RequestRedirect;
  referrerPolicy!: ReferrerPolicy;
  formData: any;

  public duplex = 'half' as const;

  constructor(public readonly socket: Socket) {
    const streamOptions = socket ? { highWaterMark: socket.readableHighWaterMark } : undefined;

    super(streamOptions);
  }

  //#region Fetch Getters

  get cache(): RequestCache {
    return this._cache;
  }

  // Fetch API 'headers' getter
  get headers() {
    return this._headers;
  }

  get integrity(): string {
    return this._integrity;
  }

  get referrer(): string {
    return this._referrer;
  }

  get keepalive(): boolean {
    return this._keepalive;
  }

  get signal(): AbortSignal {
    return this._signal;
  }

  get body() {
    return this._body;
  }

  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  //#endregion Fetch Getters

  //#region Fetch API

  public clone(): FetchIncomingMessage {
    throw new Error('Method not implemented.');
  }

  // Implement Fetch API body methods
  async arrayBuffer() {
    const chunks = [];
    for await (const chunk of this.socket) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).buffer;
  }

  async text() {
    const buffer = await this.arrayBuffer();
    return Buffer.from(buffer).toString('utf-8');
  }

  async json() {
    const textData = await this.text();
    return JSON.parse(textData);
  }

  async blob(): Promise<Blob> {
    throw new Error('Method not implemented.');
  }

  //#endregion Fetch API

  //#region node:http compat

  _dumped = false;
  aborted = false;

  httpVersionMajor!: number;
  httpVersionMinor!: number;
  httpVersion!: string;
  joinDuplicateHeaders!: string;
  complete!: boolean;

  _dump() {
    if (!this._dumped) {
      this._dumped = true;

      // If there is buffered data, it may trigger 'data' events.
      // Remove 'data' event listeners explicitly.
      this.removeAllListeners('data');
      this.resume();
    }
  }

  _addHeaderLines(headers: string[], headerCount: number) {
    if (headers && headers.length) {
      if (this.complete) {
        // this.rawTrailers = headers;
        // this[kTrailersCount] = n;
        // dest = this[kTrailers];

        throw new Error('Setting trailers not implemented');
      }

      for (let i = 0; i < headerCount; i += 2) {
        this._addHeaderLine(headers[i], headers[i + 1]);
      }
    }
  }

  setTimeout(msecs: number, callback: (...args: any[]) => void) {
    if (callback) {
      this.on('timeout', callback);
    }

    this.socket.setTimeout(msecs);
    return this;
  }

  // // Argument n cannot be factored out due to the overhead of
  // // argument adaptor frame creation inside V8 in case that number of actual
  // // arguments is different from expected arguments.
  // // Ref: https://bugs.chromium.org/p/v8/issues/detail?id=10201
  // // NOTE: Argument adapt frame issue might be solved in V8 engine v8.9.
  // // Refactoring `n` out might be possible when V8 is upgraded to that
  // // version.
  // // Ref: https://v8.dev/blog/v8-release-89
  // _read(n) {
  //     if (!this._consuming) {
  //         this._readableState.readingMore = false;
  //         this._consuming = true;
  //     }

  //     // We actually do almost nothing here, because the parserOnBody
  //     // function fills up our internal buffer directly.  However, we
  //     // do need to unpause the underlying socket so that it flows.
  //     if (this.socket.readable) readStart(this.socket);
  // }

  /**
   * Destroys the stream, optionally emitting an error and invoking a callback.
   *
   * If the stream is not yet ended or complete, it sets the `aborted` flag to true
   * and emits an 'aborted' event.
   *
   * If the stream is aborted and the underlying socket is not already destroyed,
   * it destroys the socket and ensures the callback is called even if the socket
   * is prematurely closed.
   *
   * If the socket is already destroyed or the stream is not aborted, it schedules
   * the callback to be called on the next tick.
   *
   * Original description from `node:http`:
   *
   * > It's possible that the socket will be destroyed, and removed from
   * > any messages, before ever calling this.  In that case, just skip
   * > it, since something else is destroying this connection anyway.
   *
   * @param err - The error to emit, if any.
   * @param cb - The callback to invoke once the stream is destroyed.
   */
  _destroy(err: Error, cb: Function) {
    if (!this.readableEnded || !this.complete) {
      this.aborted = true;
      this.emit('aborted');
    }

    // If aborted and the underlying socket is not already destroyed,
    // destroy it.
    // We have to check if the socket is already destroyed because finished
    // does not call the callback when this method is invoked from `_http_client`
    // in `test/parallel/test-http-client-spurious-aborted.js`
    if (this.socket && !this.socket.destroyed && this.aborted) {
      this.socket.destroy(err);
      const cleanup = finished(this.socket, (e) => {
        if (e?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
          e = null;
        }
        cleanup();
        process.nextTick(onError, this, e || err, cb);
      });
    } else {
      process.nextTick(onError, this, err, cb);
    }
  }

  private _addHeaderLine(field: string, value: string) {
    field = matchKnownFields(field);

    const flag = field.charCodeAt(0);

    if (flag === 0 || flag === 2) {
      field = field.slice(1);

      const val = this._headers.get(field);

      // Make a delimited list
      if (typeof val === 'string') {
        this._headers.set(field, (flag === 0 ? ', ' : '; ') + value);
      } else {
        this._headers.set(field, value);
      }
    } else if (flag === 1) {
      // Array header -- only Set-Cookie at the moment
      const existingSetCookies = this._headers.get('set-cookie');

      if (existingSetCookies) {
        this._headers.setCookie = [...existingSetCookies, value];
      } else {
        this._headers.setCookie = [value];
      }
    } else if (this.joinDuplicateHeaders) {
      // RFC 9110 https://www.rfc-editor.org/rfc/rfc9110#section-5.2
      // https://github.com/nodejs/node/issues/45699
      // allow authorization multiple fields
      // Make a delimited list
      if (!this._headers.has(field)) {
        this._headers.set(field, value);
      } else {
        this._headers.set(field, this._headers.get(field) + ', ' + value);
      }
    } else if (!this._headers.has(field)) {
      // Drop duplicates
      this._headers.set(field, value);
    }
  }

  //#endregion node:http compat
}
