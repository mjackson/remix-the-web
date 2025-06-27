/**
 * Pure JavaScript HTTP/1.1 parser implementation
 * This is an experimental alternative to the WASM-based parser
 */

const METHODS = [
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

// Parser types - match llhttp constants
export const HTTP_BOTH = 0;
export const HTTP_REQUEST = 1;
export const HTTP_RESPONSE = 2;
const CR = 0x0d; // \r
const LF = 0x0a; // \n
const SPACE = 0x20; // ' '
const COLON = 0x3a; // ':'
const TAB = 0x09; // \t

interface ParseState {
  state:
    | 'START_LINE'
    | 'HEADER_FIELD'
    | 'HEADER_VALUE'
    | 'HEADERS_COMPLETE'
    | 'BODY'
    | 'CHUNK_SIZE'
    | 'CHUNK_DATA'
    | 'CHUNK_END'
    | 'COMPLETE';
  parserType: number;
  isResponse: boolean;
  method: string;
  url: string;
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  headers: Record<string, string | string[]>;
  headerField: string;
  headerValue: string;
  contentLength: number;
  bodyBytesRead: number;
  isChunked: boolean;
  chunkSize: number;
  chunkBytesRead: number;
  buffer: Uint8Array;
  bufferPos: number;
  shouldKeepAlive: boolean;
  upgrade: boolean;
  headersSize: number;
  connection: string;
}

export interface JSParserOptions {
  type?: number;
  maxHeadersSize?: number;
  maxBodySize?: number;
  onRequest?: (request: any) => void;
  onResponse?: (response: any) => void;
  onBody?: (chunk: Uint8Array) => boolean | void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class HttpParserJS {
  #options: JSParserOptions;
  #state: ParseState;
  #paused = false;
  #decoder = new TextDecoder();

  constructor(options: JSParserOptions = {}) {
    this.#options = options;
    this.#state = this.#createInitialState(options.type ?? HTTP_BOTH);
  }

  #createInitialState(parserType: number): ParseState {
    return {
      state: 'START_LINE',
      parserType,
      isResponse: false,
      method: '',
      url: '',
      statusCode: 0,
      statusMessage: '',
      httpVersion: '',
      headers: {},
      headerField: '',
      headerValue: '',
      contentLength: -1,
      bodyBytesRead: 0,
      isChunked: false,
      chunkSize: 0,
      chunkBytesRead: 0,
      buffer: new Uint8Array(0),
      bufferPos: 0,
      shouldKeepAlive: true,
      upgrade: false,
      headersSize: 0,
      connection: '',
    };
  }

  write(chunk: Uint8Array) {
    if (this.#paused) return;

    // Append to existing buffer
    let oldBufferRemaining = this.#state.buffer.length - this.#state.bufferPos;
    let newBuffer = new Uint8Array(oldBufferRemaining + chunk.length);
    if (oldBufferRemaining > 0) {
      newBuffer.set(this.#state.buffer.subarray(this.#state.bufferPos));
    }
    newBuffer.set(chunk, oldBufferRemaining);
    this.#state.buffer = newBuffer;
    this.#state.bufferPos = 0;

    try {
      while (
        (this.#state.bufferPos < this.#state.buffer.length ||
          this.#state.state === 'HEADERS_COMPLETE' ||
          this.#state.state === 'COMPLETE') &&
        !this.#paused
      ) {
        let prevPos = this.#state.bufferPos;
        let prevState = this.#state.state;
        switch (this.#state.state) {
          case 'START_LINE':
            this.#parseStartLine();
            break;
          case 'HEADER_FIELD':
            this.#parseHeaderField();
            break;
          case 'HEADER_VALUE':
            this.#parseHeaderValue();
            break;
          case 'HEADERS_COMPLETE':
            this.#handleHeadersComplete();
            break;
          case 'BODY':
            this.#parseBody();
            break;
          case 'CHUNK_SIZE':
            this.#parseChunkSize();
            break;
          case 'CHUNK_DATA':
            this.#parseChunkData();
            break;
          case 'CHUNK_END':
            this.#parseChunkEnd();
            break;
          case 'COMPLETE':
            // Reset state for next message on keep-alive connection
            if (this.#state.shouldKeepAlive) {
              let remainingBuffer = this.#state.buffer.slice(this.#state.bufferPos);
              let parserType = this.#state.parserType;
              this.#state = this.#createInitialState(parserType);
              if (remainingBuffer.length > 0) {
                this.#state.buffer = remainingBuffer;
                this.#state.bufferPos = 0;
                // Continue parsing if there's enough data for a new request
                // (at least 4 bytes for "GET " or similar)
                if (remainingBuffer.length < 4) {
                  return;
                }
              } else {
                return;
              }
            } else {
              return;
            }
        }

        // Prevent infinite loop if no progress was made
        if (this.#state.bufferPos === prevPos && prevState === this.#state.state) {
          break;
        }
      }
    } catch (error) {
      this.#options.onError?.(error as Error);
    }
  }

  #parseStartLine() {
    let lineEnd = this.#findLineEnd();
    if (lineEnd === -1) return;

    // Check for null bytes in the start line
    let lineBytes = this.#state.buffer.subarray(this.#state.bufferPos, lineEnd);
    for (let i = 0; i < lineBytes.length; i++) {
      if (lineBytes[i] === 0) {
        throw new Error('Invalid char in url path');
      }
    }

    let line = this.#decoder.decode(lineBytes);
    let parts = line.split(' ');

    if (parts.length < 2) {
      throw new Error('Invalid start line');
    }

    // Determine if this is a request or response
    if (parts[0].startsWith('HTTP/')) {
      // Response: HTTP/1.1 200 OK
      if (this.#state.parserType === HTTP_REQUEST) {
        throw new Error('Unexpected HTTP request, does not match HTTP/1.1 protocol');
      }
      this.#parseResponseLine(parts);
    } else {
      // Request: GET /path HTTP/1.1
      if (this.#state.parserType === HTTP_RESPONSE) {
        throw new Error('Unexpected HTTP request, does not match HTTP/1.1 protocol');
      }
      this.#parseRequestLine(parts);
    }

    this.#state.bufferPos = lineEnd + 2; // Skip CRLF
    this.#state.state = 'HEADER_FIELD';
  }

  #parseRequestLine(parts: string[]) {
    this.#state.method = parts[0];
    this.#state.url = parts[1];

    if (parts.length === 2) {
      // HTTP/0.9 - no version specified
      this.#state.httpVersion = 'HTTP/0.9';
    } else if (parts.length === 3) {
      this.#state.httpVersion = parts[2];
      if (!this.#state.httpVersion.startsWith('HTTP/')) {
        throw new Error('Invalid HTTP version');
      }
      // Only support specific HTTP versions that llhttp accepts
      let version = this.#state.httpVersion.substring(5);
      if (version !== '0.9' && version !== '1.0' && version !== '1.1' && version !== '2.0') {
        throw new Error('Invalid HTTP version');
      }
    } else {
      throw new Error('Invalid request line');
    }

    if (!METHODS.includes(this.#state.method)) {
      throw new Error(`Invalid method: ${this.#state.method}`);
    }
  }

  #parseResponseLine(parts: string[]) {
    this.#state.isResponse = true;
    this.#state.httpVersion = parts[0];
    this.#state.statusCode = parseInt(parts[1], 10);
    this.#state.statusMessage = parts.slice(2).join(' ');

    if (!this.#state.httpVersion.startsWith('HTTP/')) {
      throw new Error('Invalid HTTP version');
    }
    // Only support specific HTTP versions that llhttp accepts
    let version = this.#state.httpVersion.substring(5);
    if (version !== '1.0' && version !== '1.1' && version !== '2.0') {
      throw new Error('Invalid HTTP version');
    }

    if (
      isNaN(this.#state.statusCode) ||
      this.#state.statusCode < 100 ||
      this.#state.statusCode > 999
    ) {
      throw new Error('Invalid status code');
    }
  }

  #parseHeaderField() {
    let start = this.#state.bufferPos;
    let buffer = this.#state.buffer;

    // Check for end of headers
    if (buffer[start] === CR) {
      if (start + 1 < buffer.length) {
        if (buffer[start + 1] === LF) {
          this.#state.bufferPos += 2;
          this.#state.state = 'HEADERS_COMPLETE';
          return;
        }
      } else {
        // Need more data to check for CRLF
        return;
      }
    }

    // Find colon
    let colonPos = -1;
    for (let i = start; i < buffer.length; i++) {
      if (buffer[i] === COLON) {
        colonPos = i;
        break;
      } else if (buffer[i] === SPACE) {
        // Header names cannot contain spaces
        throw new Error('Invalid header name');
      } else if (buffer[i] >= 127) {
        // Header names must be ASCII (DEL character 127 is also invalid)
        throw new Error('Invalid header name');
      } else if (buffer[i] === 0) {
        // Null bytes not allowed
        throw new Error('Invalid header name');
      } else if (buffer[i] < 32 && buffer[i] !== TAB) {
        // Control characters not allowed (except TAB)
        throw new Error('Invalid header name');
      }
    }

    if (colonPos === -1) {
      // Check if we have a line end - that would mean header with no value
      let lineEnd = this.#findLineEnd();
      if (lineEnd !== -1) {
        throw new Error('Invalid header format');
      }
      return; // Need more data
    }

    let fieldBytes = buffer.subarray(start, colonPos);
    this.#state.headerField = this.#decoder.decode(fieldBytes).toLowerCase();
    this.#state.headersSize += fieldBytes.length + 1; // Include colon

    if (this.#state.headersSize > (this.#options.maxHeadersSize ?? 16384)) {
      throw new Error('Headers overflow');
    }

    this.#state.bufferPos = colonPos + 1;

    // Skip optional whitespace
    while (
      this.#state.bufferPos < buffer.length &&
      (buffer[this.#state.bufferPos] === SPACE || buffer[this.#state.bufferPos] === TAB)
    ) {
      this.#state.bufferPos++;
    }

    this.#state.state = 'HEADER_VALUE';
  }

  #parseHeaderValue() {
    let lineEnd = this.#findLineEnd();
    if (lineEnd === -1) return;

    let valueBytes = this.#state.buffer.subarray(this.#state.bufferPos, lineEnd);

    // Check for invalid characters in header value
    for (let i = 0; i < valueBytes.length; i++) {
      if (valueBytes[i] === 0) {
        throw new Error('Invalid header value');
      } else if (valueBytes[i] < 32 && valueBytes[i] !== TAB) {
        throw new Error('Invalid header value');
      }
    }

    this.#state.headerValue = this.#decoder.decode(valueBytes).trim();
    this.#state.headersSize += valueBytes.length + 2; // Include CRLF

    if (this.#state.headersSize > (this.#options.maxHeadersSize ?? 16384)) {
      throw new Error('Headers overflow');
    }

    // Store header
    let field = this.#state.headerField;
    let value = this.#state.headerValue;

    if (this.#state.headers[field]) {
      if (Array.isArray(this.#state.headers[field])) {
        (this.#state.headers[field] as string[]).push(value);
      } else {
        this.#state.headers[field] = [this.#state.headers[field] as string, value];
      }
    } else {
      this.#state.headers[field] = value;
    }

    // Check for special headers
    if (field === 'content-length') {
      // Check for multiple content-length values
      if (this.#state.contentLength !== -1) {
        throw new Error('Invalid Content-Length');
      }
      // Reject Content-Length with leading + sign
      if (value.startsWith('+')) {
        throw new Error('Invalid character in Content-Length');
      }
      this.#state.contentLength = parseInt(value, 10);
      if (isNaN(this.#state.contentLength) || this.#state.contentLength < 0) {
        throw new Error('Invalid Content-Length');
      }
      // Check against max body size
      let maxBodySize = this.#options.maxBodySize ?? -1;
      if (maxBodySize > 0 && this.#state.contentLength > maxBodySize) {
        throw new Error('Body size exceeded maximum');
      }
    } else if (field === 'transfer-encoding') {
      if (value.toLowerCase().includes('chunked')) {
        this.#state.isChunked = true;
      }
      // Cannot have both Content-Length and Transfer-Encoding
      if (this.#state.contentLength !== -1) {
        throw new Error('Cannot have both Content-Length and Transfer-Encoding');
      }
    } else if (field === 'connection') {
      this.#state.connection = value;
    } else if (field === 'upgrade') {
      this.#state.upgrade = true;
    }

    this.#state.bufferPos = lineEnd + 2;
    this.#state.state = 'HEADER_FIELD';
  }

  #handleHeadersComplete() {
    // Store keep-alive state
    this.#state.shouldKeepAlive = this.#shouldKeepAlive();

    let [major, minor] = this.#state.httpVersion.substring(5).split('.');
    let httpVersion = `${major}.${minor}`;

    // Emit request or response
    if (this.#state.isResponse) {
      if (this.#options.onResponse) {
        this.#options.onResponse({
          statusCode: this.#state.statusCode,
          statusMessage: this.#state.statusMessage,
          httpVersion,
          headers: this.#state.headers,
          shouldKeepAlive: this.#state.shouldKeepAlive,
          upgrade: this.#state.upgrade,
        });
      }
    } else {
      if (this.#options.onRequest) {
        this.#options.onRequest({
          method: this.#state.method,
          url: this.#state.url,
          httpVersion,
          headers: this.#state.headers,
          shouldKeepAlive: this.#state.shouldKeepAlive,
          upgrade: this.#state.upgrade,
        });
      }
    }

    // Determine next state
    let hasBody = false;

    if (this.#state.isResponse) {
      // Responses: 1xx, 204, 304 never have bodies
      hasBody =
        this.#state.statusCode >= 200 &&
        this.#state.statusCode !== 204 &&
        this.#state.statusCode !== 304;
    } else {
      // Requests: only if Content-Length > 0 or chunked
      hasBody = this.#state.contentLength > 0 || this.#state.isChunked;
    }

    if (!hasBody || this.#state.contentLength === 0) {
      this.#state.state = 'COMPLETE';
      this.#options.onComplete?.();
    } else if (this.#state.isChunked) {
      this.#state.state = 'CHUNK_SIZE';
    } else if (this.#state.contentLength > 0) {
      this.#state.state = 'BODY';
    } else {
      // No body expected
      this.#state.state = 'COMPLETE';
      this.#options.onComplete?.();
    }
  }

  #parseBody() {
    let remaining = this.#state.buffer.length - this.#state.bufferPos;
    let bodyRemaining = this.#state.contentLength - this.#state.bodyBytesRead;
    let toRead = Math.min(remaining, bodyRemaining);

    if (toRead > 0) {
      // Check max body size
      let maxBodySize = this.#options.maxBodySize ?? -1;
      if (maxBodySize > 0 && this.#state.bodyBytesRead + toRead > maxBodySize) {
        throw new Error('Body size exceeded maximum');
      }

      let chunk = this.#state.buffer.subarray(
        this.#state.bufferPos,
        this.#state.bufferPos + toRead,
      );

      if (this.#options.onBody) {
        let shouldContinue = this.#options.onBody(chunk);
        if (shouldContinue === false) {
          this.#paused = true;
          return;
        }
      }

      this.#state.bufferPos += toRead;
      this.#state.bodyBytesRead += toRead;
    }

    if (this.#state.bodyBytesRead >= this.#state.contentLength) {
      this.#state.state = 'COMPLETE';
      this.#options.onComplete?.();
    }
  }

  #parseChunkSize() {
    // First, check if we have at least one byte to validate
    if (this.#state.bufferPos < this.#state.buffer.length) {
      let firstByte = this.#state.buffer[this.#state.bufferPos];
      // The first character must be a hex digit (0-9, a-f, A-F)
      if (
        !(
          (firstByte >= 0x30 && firstByte <= 0x39) || // 0-9
          (firstByte >= 0x41 && firstByte <= 0x46) || // A-F
          (firstByte >= 0x61 && firstByte <= 0x66)
        )
      ) {
        // a-f
        throw new Error('Invalid character in chunk size');
      }
    }

    let lineEnd = this.#findLineEnd();
    if (lineEnd === -1) return;

    // Check for invalid characters in chunk size line
    let lineBytes = this.#state.buffer.subarray(this.#state.bufferPos, lineEnd);
    for (let i = 0; i < lineBytes.length; i++) {
      let byte = lineBytes[i];
      // Allow hex digits, semicolon for extensions, and printable ASCII
      if (byte < 0x20 && byte !== 0x09) {
        // Control chars except TAB
        throw new Error('Invalid character in chunk extensions value');
      }
    }

    let sizeLine = this.#decoder.decode(lineBytes);
    let sizeStr = sizeLine.split(';')[0].trim(); // Remove chunk extensions

    // Validate chunk size hex string
    if (sizeStr.length === 0) {
      throw new Error('Invalid character in chunk size');
    }
    if (!/^[0-9a-fA-F]+$/.test(sizeStr) || sizeStr.length > 16) {
      throw new Error('Invalid character in chunk size');
    }

    this.#state.chunkSize = parseInt(sizeStr, 16);

    // Check for overflow
    if (this.#state.chunkSize > Number.MAX_SAFE_INTEGER) {
      throw new Error('Chunk size too large');
    }

    this.#state.bufferPos = lineEnd + 2;
    this.#state.chunkBytesRead = 0;

    if (this.#state.chunkSize === 0) {
      // Last chunk - need to skip the trailing CRLF
      this.#state.state = 'CHUNK_END';
    } else {
      this.#state.state = 'CHUNK_DATA';
    }
  }

  #parseChunkData() {
    let remaining = this.#state.buffer.length - this.#state.bufferPos;
    let chunkRemaining = this.#state.chunkSize - this.#state.chunkBytesRead;
    let toRead = Math.min(remaining, chunkRemaining);

    if (toRead > 0) {
      // Check max body size for chunked encoding too
      let maxBodySize = this.#options.maxBodySize ?? -1;
      if (maxBodySize > 0 && this.#state.bodyBytesRead + toRead > maxBodySize) {
        throw new Error('Body size exceeded maximum');
      }

      let chunk = this.#state.buffer.subarray(
        this.#state.bufferPos,
        this.#state.bufferPos + toRead,
      );

      if (this.#options.onBody) {
        let shouldContinue = this.#options.onBody(chunk);
        if (shouldContinue === false) {
          this.#paused = true;
          return;
        }
      }

      this.#state.bufferPos += toRead;
      this.#state.chunkBytesRead += toRead;
      this.#state.bodyBytesRead += toRead;
    }

    if (this.#state.chunkBytesRead >= this.#state.chunkSize) {
      this.#state.state = 'CHUNK_END';
    }
  }

  #parseChunkEnd() {
    // Need at least 2 bytes for CRLF
    if (this.#state.buffer.length - this.#state.bufferPos < 2) return;

    if (
      this.#state.buffer[this.#state.bufferPos] !== CR ||
      this.#state.buffer[this.#state.bufferPos + 1] !== LF
    ) {
      throw new Error('Expected LF after chunk data');
    }

    this.#state.bufferPos += 2;

    // If this was the final chunk (size 0), we're done
    if (this.#state.chunkSize === 0) {
      this.#state.state = 'COMPLETE';
      this.#options.onComplete?.();
    } else {
      this.#state.state = 'CHUNK_SIZE';
    }
  }

  #findLineEnd(): number {
    let buffer = this.#state.buffer;
    let start = this.#state.bufferPos;

    for (let i = start; i < buffer.length - 1; i++) {
      if (buffer[i] === CR && buffer[i + 1] === LF) {
        return i;
      }
    }
    return -1;
  }

  #shouldKeepAlive(): boolean {
    // Use the connection header we tracked
    if (this.#state.connection) {
      let connStr = this.#state.connection.toLowerCase();
      if (connStr.includes('close')) return false;
      if (connStr.includes('keep-alive')) return true;
    }
    // HTTP/1.1 defaults to keep-alive, HTTP/1.0 defaults to close
    return this.#state.httpVersion.endsWith('/1.1');
  }

  isPaused(): boolean {
    return this.#paused;
  }

  resume(): void {
    if (!this.#paused) return;
    this.#paused = false;
  }

  destroy(): void {
    let parserType = this.#state.parserType;
    this.#state = this.#createInitialState(parserType);
    this.#paused = false;
  }
}

export async function parseHttpStream(
  stream: ReadableStream<Uint8Array>,
  options?: JSParserOptions,
): Promise<void> {
  let parser = new HttpParserJS(options);

  try {
    let reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        parser.write(value);

        if (parser.isPaused()) {
          throw new Error(
            'Pausing is not supported in parseHttpStreamJS. Use HttpParserJS directly for pause/resume support.',
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
