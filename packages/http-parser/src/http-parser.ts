import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const constants = require('./llhttp/constants');
const textDecoder = new TextDecoder();

export const HTTP_BOTH = constants.TYPE.BOTH;
export const HTTP_REQUEST = constants.TYPE.REQUEST;
export const HTTP_RESPONSE = constants.TYPE.RESPONSE;

interface LLHttpExports {
  memory: { buffer: ArrayBuffer };
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  llhttp_alloc: (type: number) => number;
  llhttp_free: (parser: number) => void;
  llhttp_execute: (parser: number, data: number, len: number) => number;
  llhttp_resume: (parser: number) => void;
  llhttp_get_error_pos: (parser: number) => number;
  llhttp_get_error_reason: (parser: number) => number;
  llhttp_get_http_major: (parser: number) => number;
  llhttp_get_http_minor: (parser: number) => number;
  llhttp_get_method: (parser: number) => number;
}

interface LLHttpInstance {
  exports: LLHttpExports;
}

let currentParser: HttpParser | null = null;
let currentBufferRef: Uint8Array | null = null;
let currentBufferSize = 0;
let currentBufferPtr: number | null = null;

async function lazyllhttp(): Promise<LLHttpInstance> {
  let llhttpWasmData = process.env.JEST_WORKER_ID ? require('./llhttp/llhttp-wasm') : undefined;

  let mod: WebAssembly.Module;
  try {
    mod = await WebAssembly.compile(require('./llhttp/llhttp_simd-wasm'));
  } catch (e) {
    mod = await WebAssembly.compile(llhttpWasmData || require('./llhttp/llhttp-wasm'));
  }

  return (await WebAssembly.instantiate(mod, {
    env: {
      wasm_on_url(p: number, at: number, len: number) {
        if (!currentParser || currentBufferPtr === null || !currentBufferRef) {
          return -1;
        }
        assert(currentParser.ptr === p);
        let start = at - currentBufferPtr;
        return currentParser.handleUrl(
          new Uint8Array(currentBufferRef.buffer, currentBufferRef.byteOffset + start, len),
        );
      },
      wasm_on_status(p: number, at: number, len: number) {
        if (!currentParser || currentBufferPtr === null || !currentBufferRef) {
          return -1;
        }
        assert(currentParser.ptr === p);
        let start = at - currentBufferPtr;
        return currentParser.handleStatus(
          new Uint8Array(currentBufferRef.buffer, currentBufferRef.byteOffset + start, len),
        );
      },
      wasm_on_message_begin(p: number) {
        if (!currentParser) {
          return -1;
        }
        assert(currentParser.ptr === p);
        return currentParser.handleMessageBegin();
      },
      wasm_on_header_field(p: number, at: number, len: number) {
        if (!currentParser || currentBufferPtr === null || !currentBufferRef) {
          return -1;
        }
        assert(currentParser.ptr === p);
        let start = at - currentBufferPtr;
        return currentParser.handleHeaderField(
          new Uint8Array(currentBufferRef.buffer, currentBufferRef.byteOffset + start, len),
        );
      },
      wasm_on_header_value(p: number, at: number, len: number) {
        if (!currentParser || currentBufferPtr === null || !currentBufferRef) {
          return -1;
        }
        assert(currentParser.ptr === p);
        let start = at - currentBufferPtr;
        return currentParser.handleHeaderValue(
          new Uint8Array(currentBufferRef.buffer, currentBufferRef.byteOffset + start, len),
        );
      },
      wasm_on_headers_complete(
        p: number,
        statusCode: number,
        upgrade: 0 | 1,
        shouldKeepAlive: 0 | 1,
      ) {
        if (!currentParser) {
          return -1;
        }
        assert(currentParser.ptr === p);
        return currentParser.handleHeadersComplete(
          statusCode,
          upgrade === 1,
          shouldKeepAlive === 1,
        );
      },
      wasm_on_body(p: number, at: number, len: number) {
        if (!currentParser || currentBufferPtr === null || !currentBufferRef) {
          return -1;
        }
        assert(currentParser.ptr === p);
        let start = at - currentBufferPtr;
        return currentParser.handleBody(
          new Uint8Array(currentBufferRef.buffer, currentBufferRef.byteOffset + start, len),
        );
      },
      wasm_on_message_complete(p: number) {
        if (!currentParser) {
          return -1;
        }
        assert(currentParser.ptr === p);
        return currentParser.handleMessageComplete();
      },
    },
  })) as unknown as LLHttpInstance;
}

let llhttpInstance: LLHttpInstance | null = null;
let llhttpPromise: Promise<LLHttpInstance> | null = lazyllhttp();
llhttpPromise.catch(() => {});

/**
 * Get the llhttp instance for direct parser usage.
 * This is useful when you need pause/resume functionality.
 *
 * @example
 * ```ts
 * const llhttp = await getLLHttpInstance();
 * const parser = new HttpParser(llhttp, options);
 * ```
 */
export async function getLLHttpInstance(): Promise<LLHttpInstance> {
  if (!llhttpInstance) {
    if (llhttpPromise) {
      llhttpInstance = await llhttpPromise;
      llhttpPromise = null;
    } else {
      throw new Error('llhttp not initialized');
    }
  }

  return llhttpInstance;
}

/**
 * Base interface for HTTP messages (requests and responses).
 */
export interface MessageMetadata {
  /**
   * The HTTP version (e.g., "1.0", "1.1")
   */
  httpVersion: string;
  /**
   * Request/Response headers as key-value pairs.
   * Header names are lowercase.
   * If a header appears multiple times, the value will be an array.
   */
  headers: Record<string, string | string[]>;
  /**
   * Whether the connection should be kept alive after this message
   */
  shouldKeepAlive: boolean;
  /**
   * Whether this is an upgrade message (e.g., WebSocket upgrade)
   */
  upgrade: boolean;
}

/**
 * Represents an HTTP request parsed by the HttpParser.
 */
export interface RequestMetadata extends MessageMetadata {
  /**
   * The HTTP method (e.g., "GET", "POST", "PUT", etc.)
   */
  method: string;
  /**
   * The request URL path and query string
   */
  url: string;
}

/**
 * Represents an HTTP response parsed by the HttpParser.
 */
export interface ResponseMetadata extends MessageMetadata {
  /**
   * The HTTP status code (e.g., 200, 404, 500)
   */
  statusCode: number;
  /**
   * The HTTP status message (e.g., "OK", "Not Found", "Internal Server Error")
   */
  statusMessage: string;
}

export interface ParserOptions {
  /**
   * Parser type: REQUEST (1), RESPONSE (2), or BOTH (0).
   * Default is BOTH (0).
   */
  type?: number;
  /**
   * Maximum size of headers in bytes.
   * Default is 16384 bytes (16 KB).
   */
  maxHeadersSize?: number;
  /**
   * Maximum size of the body in bytes.
   * Default is -1 (no limit).
   */
  maxBodySize?: number;
  /**
   * Callback invoked when a new HTTP request is parsed.
   * @param request The parsed request metadata
   */
  onRequest?: (request: RequestMetadata) => void;
  /**
   * Callback invoked when a new HTTP response is parsed.
   * @param response The parsed response metadata
   */
  onResponse?: (response: ResponseMetadata) => void;
  /**
   * Callback invoked when a chunk of the message body is parsed.
   * @param chunk A chunk of the message body
   * @returns `false` to pause the parser, anything else to continue
   */
  onBody?: (chunk: Uint8Array) => boolean | void;
  /**
   * Callback invoked when the message parsing is complete.
   */
  onComplete?: () => void;
  /**
   * Callback invoked when an error occurs during parsing.
   * @param error An error that occurred during parsing
   */
  onError?: (error: Error) => void;
}

/**
 * A streaming HTTP parser for HTTP/1.1.
 *
 * @example Basic usage:
 * ```ts
 * const llhttp = await getLLHttpInstance();
 * const parser = new HttpParser(llhttp, {
 *   onRequest(request) {
 *     console.log(request.method, request.url);
 *   },
 *   onBody(chunk) {
 *     process(chunk);
 *   },
 *   onComplete() {
 *     console.log('Message complete');
 *   }
 * });
 *
 * try {
 *   parser.write(chunk1);
 *   parser.write(chunk2);
 *   // ... more chunks
 * } finally {
 *   parser.destroy();
 * }
 * ```
 *
 * @example Advanced usage with pause/resume:
 * ```ts
 * const llhttp = await getLLHttpInstance();
 * const parser = new HttpParser(llhttp, {
 *   onBody(chunk) {
 *     if (bufferFull) {
 *       return false; // Pause parsing
 *     }
 *     buffer.push(chunk);
 *     return true;
 *   }
 * });
 *
 * try {
 *   for await (const chunk of stream) {
 *     parser.write(chunk);
 *
 *     if (parser.isPaused()) {
 *       await drainBuffer();
 *       parser.resume(); // Continue parsing
 *     }
 *   }
 * } finally {
 *   parser.destroy(); // Always clean up
 * }
 * ```
 */
export class HttpParser {
  #llhttp: LLHttpExports;
  #paused = false;
  #type: number;
  #buffer: Uint8Array | null = null;
  ptr: number | null;

  method = 0;
  url = '';
  statusCode = 0;
  statusMessage = '';
  versionMajor = 0;
  versionMinor = 0;
  headers: Uint8Array[] = [];
  headersSize = 0;
  headersMaxSize: number;
  shouldKeepAlive = false;
  upgrade = false;

  bytesRead = 0;
  contentLength = '';
  transferEncoding = '';
  connection = '';
  maxBodySize: number;

  #onRequest?: (request: RequestMetadata) => void;
  #onResponse?: (response: ResponseMetadata) => void;
  #onBody?: (chunk: Uint8Array) => boolean | void;
  #onComplete?: () => void;
  #onError: (error: Error) => void;

  constructor({ exports }: LLHttpInstance, options?: ParserOptions) {
    this.#llhttp = exports;
    this.#type = options?.type ?? constants.TYPE.BOTH;
    this.ptr = this.#llhttp.llhttp_alloc(this.#type);
    this.headersMaxSize = options?.maxHeadersSize ?? 16384;
    this.maxBodySize = options?.maxBodySize ?? -1;

    this.#onRequest = options?.onRequest;
    this.#onResponse = options?.onResponse;
    this.#onBody = options?.onBody;
    this.#onComplete = options?.onComplete;
    this.#onError = options?.onError ?? (() => {});
  }

  write(chunk: Uint8Array) {
    assert(currentParser === null);
    assert(this.ptr != null);
    assert(!this.#paused);

    let llhttp = this.#llhttp;

    if (chunk.length > currentBufferSize) {
      if (currentBufferPtr !== null) {
        llhttp.free(currentBufferPtr);
      }
      currentBufferSize = Math.ceil(chunk.length / 4096) * 4096;
      currentBufferPtr = llhttp.malloc(currentBufferSize);
    }

    assert(currentBufferPtr !== null);
    new Uint8Array(llhttp.memory.buffer, currentBufferPtr, currentBufferSize).set(chunk);

    try {
      let ret: number;

      try {
        currentBufferRef = chunk;
        currentParser = this;
        ret = llhttp.llhttp_execute(this.ptr, currentBufferPtr, chunk.length);
      } finally {
        currentParser = null;
        currentBufferRef = null;
      }

      if (ret !== constants.ERROR.OK) {
        let errorPos = llhttp.llhttp_get_error_pos(this.ptr) - currentBufferPtr;
        let data = chunk.subarray(errorPos);

        if (ret === constants.ERROR.PAUSED_UPGRADE) {
          this.handleUpgrade(data);
        } else if (ret === constants.ERROR.PAUSED) {
          this.#paused = true;
          // Store the unparsed portion of the chunk
          let unparsedOffset = llhttp.llhttp_get_error_pos(this.ptr) - currentBufferPtr;
          this.#buffer = chunk.slice(unparsedOffset);
          return;
        } else {
          let ptr = llhttp.llhttp_get_error_reason(this.ptr);
          let message = '';
          if (ptr) {
            let len = new Uint8Array(llhttp.memory.buffer, ptr).indexOf(0);
            let errorBytes = new Uint8Array(llhttp.memory.buffer, ptr, len);
            message =
              'Message does not match the HTTP/1.1 protocol (' +
              textDecoder.decode(errorBytes) +
              ')';
          }
          throw new Error(message);
        }
      }
    } catch (error) {
      this.#onError(error as Error);
    }
  }

  destroy() {
    assert(currentParser === null);

    if (this.ptr != null) {
      this.#llhttp.llhttp_free(this.ptr);
      this.ptr = null;
    }

    this.#paused = false;
    this.#buffer = null;
  }

  /**
   * Returns true if the parser is currently paused.
   */
  isPaused(): boolean {
    return this.#paused;
  }

  /**
   * Resumes parsing after being paused.
   * This will process any unparsed data from the chunk that caused the pause.
   */
  resume(): void {
    if (!this.#paused) {
      return;
    }

    this.#paused = false;

    if (this.#buffer && this.ptr) {
      let unparsedData = this.#buffer;
      this.#buffer = null;

      // Resume the parser and process the unparsed data
      this.#llhttp.llhttp_resume(this.ptr);
      this.write(unparsedData);
    }
  }

  handleUrl(buf: Uint8Array) {
    this.url += textDecoder.decode(buf);
    return 0;
  }

  handleStatus(buf: Uint8Array) {
    this.statusMessage += textDecoder.decode(buf);
    return 0;
  }

  handleMessageBegin() {
    this.method = 0;
    this.url = '';
    this.statusCode = 0;
    this.statusMessage = '';
    this.versionMajor = 0;
    this.versionMinor = 0;
    this.headers = [];
    this.headersSize = 0;
    this.shouldKeepAlive = false;
    this.upgrade = false;
    this.contentLength = '';
    this.transferEncoding = '';
    this.connection = '';
    this.bytesRead = 0;

    return 0;
  }

  handleHeaderField(buf: Uint8Array) {
    let len = this.headers.length;

    if ((len & 1) === 0) {
      this.headers.push(buf);
    } else {
      let existing = this.headers[len - 1];
      let combined = new Uint8Array(existing.length + buf.length);
      combined.set(existing);
      combined.set(buf, existing.length);
      this.headers[len - 1] = combined;
    }

    this.trackHeader(buf.length);

    return 0;
  }

  handleHeaderValue(buf: Uint8Array) {
    let len = this.headers.length;

    if ((len & 1) === 1) {
      this.headers.push(buf);
      len += 1;
    } else {
      let existing = this.headers[len - 1];
      let combined = new Uint8Array(existing.length + buf.length);
      combined.set(existing);
      combined.set(buf, existing.length);
      this.headers[len - 1] = combined;
    }

    let key = this.headers[len - 2];
    if (key.length === 10) {
      let headerName = textDecoder.decode(key).toLowerCase();
      if (headerName === 'connection') {
        this.connection += textDecoder.decode(buf);
      }
    } else if (key.length === 14 && textDecoder.decode(key).toLowerCase() === 'content-length') {
      this.contentLength += textDecoder.decode(buf);
    } else if (key.length === 17 && textDecoder.decode(key).toLowerCase() === 'transfer-encoding') {
      this.transferEncoding += textDecoder.decode(buf);
    }

    this.trackHeader(buf.length);

    return 0;
  }

  trackHeader(len: number) {
    this.headersSize += len;
    if (this.headersSize >= this.headersMaxSize) {
      this.#onError(new Error('Headers overflow'));
    }
  }

  handleHeadersComplete(statusCode: number, upgrade: boolean, shouldKeepAlive: boolean) {
    assert(this.headers.length % 2 === 0);
    this.upgrade = upgrade;
    this.shouldKeepAlive = shouldKeepAlive;

    this.versionMajor = this.#llhttp.llhttp_get_http_major(this.ptr!);
    this.versionMinor = this.#llhttp.llhttp_get_http_minor(this.ptr!);

    let headers: Record<string, string | string[]> = {};
    for (let i = 0; i < this.headers.length; i += 2) {
      let key = textDecoder.decode(this.headers[i]).toLowerCase();
      let value = textDecoder.decode(this.headers[i + 1]);

      if (headers[key]) {
        if (!Array.isArray(headers[key])) {
          headers[key] = [headers[key] as string];
        }
        (headers[key] as string[]).push(value);
      } else {
        headers[key] = value;
      }
    }

    let httpVersion = `${this.versionMajor}.${this.versionMinor}`;

    if (statusCode !== 0) {
      this.statusCode = statusCode;
      if (this.#onResponse) {
        this.#onResponse({
          statusCode: this.statusCode,
          statusMessage: this.statusMessage.trim(),
          httpVersion,
          headers,
          shouldKeepAlive: this.shouldKeepAlive,
          upgrade: this.upgrade,
        });
      }
    } else {
      this.method = this.#llhttp.llhttp_get_method(this.ptr!);
      let methodKey = Object.keys(constants.METHODS).find(
        (k) => constants.METHODS[k as keyof typeof constants.METHODS] === this.method,
      );
      let methodName = methodKey || 'UNKNOWN';

      if (this.#onRequest) {
        this.#onRequest({
          method: methodName,
          url: this.url,
          httpVersion,
          headers,
          shouldKeepAlive: this.shouldKeepAlive,
          upgrade: this.upgrade,
        });
      }
    }

    return 0;
  }

  handleBody(buf: Uint8Array) {
    if (this.maxBodySize > -1 && this.bytesRead + buf.length > this.maxBodySize) {
      this.#onError(new Error('Body size exceeded maximum'));
      return -1;
    }

    this.bytesRead += buf.length;

    if (this.#onBody) {
      let shouldContinue = this.#onBody(buf);
      if (shouldContinue === false) {
        this.#paused = true;
        return constants.ERROR.PAUSED;
      }
    }

    return 0;
  }

  handleMessageComplete() {
    if (this.#onComplete) {
      this.#onComplete();
    }

    return 0;
  }

  handleUpgrade(_head: Uint8Array) {
    // TODO: Implement upgrade handling if needed
  }
}

/**
 * Parse an HTTP message from a stream.
 *
 * This function provides a simple, high-performance API for parsing HTTP messages
 * from streams.
 *
 * It does NOT support pausing and will throw an error if `onBody` returns `false`.
 * For use cases requiring pause/resume functionality (e.g., backpressure handling),
 * use the `HttpParser` class directly.
 *
 * @param stream A ReadableStream containing HTTP message data
 * @param options Options for the parser
 * @throws Error if onBody returns false (parser paused)
 */
export async function parseHttpStream(
  stream: ReadableStream<Uint8Array>,
  options?: ParserOptions,
): Promise<void> {
  let llhttp = await getLLHttpInstance();
  let parser = new HttpParser(llhttp, options);

  try {
    let reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        parser.write(value);

        if (parser.isPaused()) {
          throw new Error(
            'Pausing is not supported in parseHttpStream. Use HttpParser directly for pause/resume support.',
          );
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    parser.destroy();
  }
}
