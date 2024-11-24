import type { Blob } from 'node:buffer';
import type { Socket } from 'node:net';
import type { ReadableStream } from 'node:stream/web';
import { Readable, finished } from 'node:stream';

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

import { consumeBody, parseJSONFromBytes, utf8DecodeBytes } from './body.js';
import { matchKnownFields, onError, isDisturbed, serializeUrl } from './util.js';

const kAbortController = Symbol('abortController');

export class FetchIncomingMessage extends Readable implements Request {
  //#region Private Fields

  #state!: any;

  #headers = new SuperHeaders();

  #signal!: AbortSignal;

  #stream!: ReadableStream<Uint8Array>;

  [kAbortController]: AbortController | undefined;

  //#endregion Private Fields

  constructor(public readonly socket: Socket) {
    super(socket ? { highWaterMark: socket.readableHighWaterMark } : undefined);

    // initialize fetch request state
    // see https://fetch.spec.whatwg.org/#dom-request
    // see https://github.com/nodejs/undici/blob/main/lib/web/fetch/request.js

    // const ac = new AbortController();
    // this.on('close', () => {
    //   ac.abort();
    // });

    // let signal = ac.signal;
    // this.#signal = ac.signal;

    // if (signal.aborted) {
    //   ac.abort(signal.reason);
    // } else {
    //   // Keep a strong ref to ac while request object
    //   // is alive. This is needed to prevent AbortController
    //   // from being prematurely garbage collected.
    //   // See, https://github.com/nodejs/undici/issues/1926.
    //   this[kAbortController] = ac;
    // }

    this.#state = {
      body: {},
    };
  }

  //#region Fetch Getters

  /**
   * Returns request’s HTTP method, which is "GET" by default.
   */
  get method() {
    // The method getter steps are to return this’s request’s method.
    return this.#state.method;
  }

  /**
   * Returns the URL of request as a string.
   */
  get url(): string {
    // The url getter steps are to return this’s request’s URL, serialized.
    return serializeUrl(this.#state.url);
  }

  /**
   * Returns the kind of resource requested by request, e.g., "document"
   * or "script".
   */
  get destination(): RequestDestination {
    // The destination getter are to return this’s request’s destination.
    return this.#state.destination ?? '';
  }

  /**
   * Returns the referrer of request. Its value can be a same-origin URL if
   * explicitly set in init, the empty string to indicate no referrer, and
   * "about:client" when defaulting to the global’s default. This is used
   * during fetching to determine the value of the `Referer` header of the
   * request being made.
   */
  get referrer(): string {
    // 1. If this’s request’s referrer is "no-referrer", then return the
    // empty string.
    if (this.#state.referrer === 'no-referrer') {
      return '';
    }

    // 2. If this’s request’s referrer is "client", then return
    // "about:client".
    if (this.#state.referrer === 'client') {
      return 'about:client';
    }

    // Return this’s request’s referrer, serialized.
    return this.#state.referrer.toString();
  }

  /**
   * Returns the referrer policy associated with request.
   * This is used during fetching to compute the value of the request’s
   * referrer.
   */
  get referrerPolicy(): ReferrerPolicy {
    // The referrerPolicy getter steps are to return this’s request’s referrer policy.
    return this.#state.referrerPolicy;
  }

  /**
   * Returns the mode associated with request, which is a string indicating
   * whether the request will use CORS, or will be restricted to same-origin
   * URLs.
   */
  get mode(): RequestMode {
    // The mode getter steps are to return this’s request’s mode.
    return this.#state.mode;
  }

  /**
   * Returns the credentials mode associated with request,
   * which is a string indicating whether credentials will be sent with the
   * request always, never, or only when sent to a same-origin URL.
   */
  get credentials(): RequestCredentials {
    // The credentials getter steps are to return this’s request’s credentials mode.
    return this.#state.credentials;
  }

  /**
   * Returns the cache mode associated with request,
   * which is a string indicating how the request will
   * interact with the browser’s cache when fetching.
   */
  get cache(): RequestCache {
    // The cache getter steps are to return this’s request’s cache mode.
    return this.#state.cache;
  }

  /**
   * Returns the redirect mode associated with request,
   * which is a string indicating how redirects for the
   * request will be handled during fetching. A request
   * will follow redirects by default.
   */
  get redirect(): RequestRedirect {
    // The redirect getter steps are to return this’s request’s redirect mode.
    return this.#state.redirect;
  }

  /**
   * Returns request’s sub-resource integrity metadata, which is a
   * cryptographic hash of the resource being fetched. Its value
   * consists of multiple hashes separated by whitespace. [SRI]
   */
  get integrity() {
    // The integrity getter steps are to return this’s request’s integrity
    // metadata.
    return this.#state.integrity;
  }

  // Fetch API 'headers' getter
  get headers() {
    return this.#headers;
  }

  /**
   * Returns a boolean indicating whether or not request can outlive the
   * global in which it was created.
   */
  get keepalive(): boolean {
    // The keepalive getter steps are to return this’s request’s keepalive.
    return this.#state.keepalive;
  }

  /**
   *  Returns a boolean indicating whether or not request is for a reload
   *  navigation.
   */
  get isReloadNavigation(): boolean {
    // The isReloadNavigation getter steps are to return true if this’s
    // request’s reload-navigation flag is set; otherwise false.
    return this.#state.reloadNavigation;
  }

  /**
   * Returns a boolean indicating whether or not request is for a history
   * navigation (a.k.a. back-forward navigation).
   */
  get isHistoryNavigation(): boolean {
    // The isHistoryNavigation getter steps are to return true if this’s request’s
    // history-navigation flag is set; otherwise false.
    return this.#state.historyNavigation;
  }

  /**
   * Returns the signal associated with request, which is an AbortSignal
   * object indicating whether or not request has been aborted, and its
   * abort event handler.
   */
  get signal(): AbortSignal {
    // The signal getter steps are to return this’s signal.
    return this.#signal;
  }

  get body() {
    if (this.method === 'GET' || this.method === 'HEAD') {
      return null;
    }

    // // lazily convert the body to a ReadableStream on first access
    if (!this.#state.body) {
      this.#state.body = {
        stream: Readable.toWeb(this),
        source: null,
      };
    }

    return this.#state.body ? this.#state.body.stream : null;
  }

  get bodyUsed(): boolean {
    return !!this.#state.body && isDisturbed(this);
  }

  get duplex() {
    return 'half' as const;
  }

  //#endregion Fetch Getters

  //#region Fetch API

  /**
   * **DO NOT USE**, this method is not implemented and will always throw. Kept
   * only for compatibility with type definitions.
   *
   * @throws {Error} Method not implemented
   */
  // @ts-expect-error
  public clone(): FetchIncomingMessage {
    throw new Error('Method not implemented.');
  }

  /**
   * **DO NOT USE**, will always throw. Kept only for compatibility with type definitions.
   *
   * @deprecated Use `Request.formDataAsync()` instead which returns an `AsyncGenerator<MultipartPart>`
   * that can be consumed like so:
   *
   * ```javascript
   * for await (const part of formDataAsync) {
   *   // process part
   * }
   * ```
   * @throws {Error} Method not implemented
   */
  // @ts-expect-error
  async formData(): Promise<FormData> {
    throw new TypeError('Method not implemented.');
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // The arrayBuffer() method steps are to return the result
    // of running consume body with this and the following step
    // given a byte sequence bytes: return a new ArrayBuffer
    // whose contents are bytes.
    const result = this.bytes().then((bytes) => bytes.buffer);

    return result;
  }

  async text(): Promise<string> {
    // The text() method steps are to return the result of running
    // consume body with this and UTF-8 decode.
    return consumeBody(this.#state, utf8DecodeBytes);
  }

  async json<T = unknown>(): Promise<T> {
    // The json() method steps are to return the result of running
    // consume body with this and parse JSON from bytes.
    return consumeBody(this.#state, parseJSONFromBytes);
  }

  async blob(): Promise<Blob> {
    throw new Error('Method not implemented.');
  }

  async bytes() {
    // The bytes() method steps are to return the result of running consume body
    // with this and the following step given a byte sequence bytes: return the
    // result of creating a Uint8Array from bytes in this’s relevant realm.
    return consumeBody(this.#state, (bytes) => new Uint8Array(bytes));
  }

  //#endregion Fetch API

  //#region node:http compat

  set method(value: string) {
    this.#state.method = value;

    if (value !== 'GET' && value !== 'HEAD') {
      this.#state.body = {
        stream: Readable.toWeb(this),
      };
    }
  }

  set url(value: string) {
    const protocol = 'encrypted' in this.socket && this.socket.encrypted ? 'https:' : 'http:';
    const host = this.headers.host ?? 'localhost';

    let port =
      this.socket.localPort && ![80, 443].includes(this.socket.localPort)
        ? this.socket.localPort
        : null;

    if (!port) {
      const server = (this.socket as any).server;
      port = server?.address()?.port;
    }

    const hostPort = port ? `:${port}` : '';

    this.#state.url = new URL(value, `${protocol}//${host}${hostPort}`);
  }

  get _dumped(): boolean {
    return !!this.#state._dumped;
  }

  aborted = false;

  httpVersionMajor!: number;
  httpVersionMinor!: number;
  httpVersion!: string;
  joinDuplicateHeaders!: string;
  complete!: boolean;

  _dump() {
    if (!this._dumped) {
      this.#state._dumped = true;

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

      const val = this.#headers.get(field);

      // Make a delimited list
      if (typeof val === 'string') {
        this.#headers.set(field, (flag === 0 ? ', ' : '; ') + value);
      } else {
        this.#headers.set(field, value);
      }
    } else if (flag === 1) {
      // Array header -- only Set-Cookie at the moment
      const existingSetCookies = this.#headers.get('set-cookie');

      if (existingSetCookies) {
        this.#headers.setCookie = [...existingSetCookies, value];
      } else {
        this.#headers.setCookie = [value];
      }
    } else if (this.joinDuplicateHeaders) {
      // RFC 9110 https://www.rfc-editor.org/rfc/rfc9110#section-5.2
      // https://github.com/nodejs/node/issues/45699
      // allow authorization multiple fields
      // Make a delimited list
      if (!this.#headers.has(field)) {
        this.#headers.set(field, value);
      } else {
        this.#headers.set(field, this.#headers.get(field) + ', ' + value);
      }
    } else if (!this.#headers.has(field)) {
      // Drop duplicates
      this.#headers.set(field, value);
    }
  }

  //#endregion node:http compat

  //#region Other

  [Symbol.toStringTag] = {
    value: 'FetchIncomingMessage',
    configurable: true,
  };

  //#endregion Other
}
