import Headers from '@mjackson/headers';

import { readStream } from './read-stream.ts';
import {
  type SearchFunction,
  createSearch,
  type PartialTailSearchFunction,
  createPartialTailSearch,
} from './buffer-search.ts';

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartParseError';
  }
}

export class MaxHeaderSizeExceededError extends MultipartParseError {
  constructor(maxHeaderSize: number) {
    super(`Multipart header size exceeds maximum allowed size of ${maxHeaderSize} bytes`);
    this.name = 'MaxHeaderSizeExceededError';
  }
}

export class MaxFileSizeExceededError extends MultipartParseError {
  constructor(maxFileSize: number) {
    super(`File size exceeds maximum allowed size of ${maxFileSize} bytes`);
    this.name = 'MaxFileSizeExceededError';
  }
}

type MultipartMessageSource =
  | ReadableStream<Uint8Array>
  | Uint8Array
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>;

export type MultipartPartHandler = (part: MultipartPart) => void | Promise<void>;

export interface ParseMultipartOptions {
  boundary: string;
  maxHeaderSize?: number;
  maxFileSize?: number;
}

/**
 * Parse a `multipart/*` buffer or stream and yield each part it finds as a `MultipartPart` object.
 *
 * ```ts
 * import { parseMultipart } from '@mjackson/multipart-parser';
 *
 * let boundary = '----WebKitFormBoundaryzv5Z4JY8k9lG0yQW';
 *
 * await parseMultipart(message, { boundary }, async (part) => {
 *   if (part.isFile) {
 *     console.log(part.filename);
 *
 *     if (part.mediaType.startsWith('text/')) {
 *       let text = await part.text();
 *       // ...
 *     } else {
 *       let buffer = await part.bytes();
 *       // ...
 *     }
 *   } else {
 *     let text = await part.text();
 *     // ...
 *   }
 * });
 * ```
 *
 * Note: This is a low-level API that requires manual handling of the stream and boundary. If you're
 * building a web server, consider using `parseMultipartRequest(request)` instead.
 */
export async function parseMultipart(
  message: MultipartMessageSource,
  options: ParseMultipartOptions,
  handler: MultipartPartHandler,
): Promise<void> {
  let parser = new MultipartParser(options.boundary, {
    maxHeaderSize: options.maxHeaderSize,
    maxFileSize: options.maxFileSize,
  });

  await parser.parse(message, handler);
}

const findDoubleNewline = createSearch('\r\n\r\n');

export type MultipartParserOptions = Omit<ParseMultipartOptions, 'boundary'>;

const MultipartParserStateStart = 0;
const MultipartParserStateAfterBoundary = 1;
const MultipartParserStateHeader = 2;
const MultipartParserStateBody = 3;
const MultipartParserStateDone = 4;

/**
 * A parser for `multipart/*` HTTP messages.
 */
export class MultipartParser {
  boundary: string;
  maxHeaderSize: number;
  maxFileSize: number;

  #findOpeningBoundary: SearchFunction;
  #openingBoundaryLength: number;

  #findBoundary: SearchFunction;
  #findPartialTailBoundary: PartialTailSearchFunction;
  #boundaryLength: number;

  #state = MultipartParserStateStart;
  #buffer: Uint8Array | null = null;
  #bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  #bodyLength = 0;

  constructor(boundary: string, options?: MultipartParserOptions) {
    this.boundary = boundary;
    this.maxHeaderSize = options?.maxHeaderSize ?? 8 * 1024;
    this.maxFileSize = options?.maxFileSize ?? Infinity;

    this.#findOpeningBoundary = createSearch(`--${boundary}`);
    this.#openingBoundaryLength = 2 + boundary.length; // length of '--' + boundary

    this.#findBoundary = createSearch(`\r\n--${boundary}`);
    this.#findPartialTailBoundary = createPartialTailSearch(`\r\n--${boundary}`);
    this.#boundaryLength = 4 + boundary.length; // length of '\r\n--' + boundary
  }

  /**
   * Parse a stream/buffer multipart message and call the given handler for each part it contains.
   * Resolves when the parse is finished and all handlers resolve.
   */
  async parse(message: MultipartMessageSource, handler: MultipartPartHandler): Promise<void> {
    if (this.#state !== MultipartParserStateStart) {
      this.#reset();
    }

    let promises: Promise<unknown>[] = [];

    function handlePart(part: MultipartPart): void {
      let result = handler(part);
      if (isPromise(result)) {
        promises.push(result);

        // This hack marks the promise as "handled" in Node.js to suppress
        // "unhandledRejection" warnings and avoid crashing the process.
        result.catch(() => {});
      }
    }

    if (message instanceof ReadableStream) {
      for await (let chunk of readStream(message)) {
        this.#write(chunk, handlePart);
      }
    } else if (isAsyncIterable(message)) {
      for await (let chunk of message) {
        this.#write(chunk, handlePart);
      }
    } else if (message instanceof Uint8Array) {
      this.#write(message, handlePart);
    } else if (isIterable(message)) {
      for (let chunk of message) {
        this.#write(chunk, handlePart);
      }
    } else {
      throw new TypeError('Cannot parse multipart message; expected a stream or buffer');
    }

    if (this.#state !== MultipartParserStateDone) {
      throw new MultipartParseError('Unexpected end of stream');
    }

    await Promise.all(promises);
  }

  #reset(): void {
    this.#state = MultipartParserStateStart;
    this.#buffer = null;
    this.#bodyController = null;
    this.#bodyLength = 0;
  }

  #write(chunk: Uint8Array, handler: MultipartPartHandler): void {
    if (this.#state === MultipartParserStateDone) {
      throw new MultipartParseError('Unexpected data after end of stream');
    }

    let index = 0;
    let chunkLength = chunk.length;

    if (this.#buffer !== null) {
      let newChunk = new Uint8Array(this.#buffer.length + chunkLength);
      newChunk.set(this.#buffer, 0);
      newChunk.set(chunk, this.#buffer.length);
      chunk = newChunk;
      chunkLength = chunk.length;
      this.#buffer = null;
    }

    while (true) {
      if (this.#state === MultipartParserStateBody) {
        if (chunkLength - index < this.#boundaryLength) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        let boundaryIndex = this.#findBoundary(chunk, index);

        if (boundaryIndex === -1) {
          // No boundary found, but there may be a partial match at the end of the chunk.
          let partialTailIndex = this.#findPartialTailBoundary(chunk);

          if (partialTailIndex === -1) {
            this.#writeBody(index === 0 ? chunk : chunk.subarray(index));
          } else {
            this.#writeBody(chunk.subarray(index, partialTailIndex));
            this.#buffer = chunk.subarray(partialTailIndex);
          }

          break;
        }

        this.#writeBody(chunk.subarray(index, boundaryIndex));
        this.#closeBody();

        index = boundaryIndex + this.#boundaryLength;

        this.#state = MultipartParserStateAfterBoundary;
      }

      if (this.#state === MultipartParserStateAfterBoundary) {
        if (chunkLength - index < 2) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        if (chunk[index] === 45 && chunk[index + 1] === 45) {
          this.#state = MultipartParserStateDone;
          break;
        }

        index += 2; // Skip \r\n after boundary

        this.#state = MultipartParserStateHeader;
      }

      if (this.#state === MultipartParserStateHeader) {
        if (chunkLength - index < 4) {
          this.#buffer = chunk.subarray(index);
          break;
        }

        let headerEndIndex = findDoubleNewline(chunk, index);

        if (headerEndIndex === -1) {
          if (chunkLength - index > this.maxHeaderSize) {
            throw new MaxHeaderSizeExceededError(this.maxHeaderSize);
          }

          this.#buffer = chunk.subarray(index);
          break;
        }

        if (headerEndIndex - index > this.maxHeaderSize) {
          throw new MaxHeaderSizeExceededError(this.maxHeaderSize);
        }

        let header = chunk.subarray(index, headerEndIndex);
        let part = new MultipartPart(
          header,
          new ReadableStream({
            start: (controller) => {
              this.#bodyController = controller;
              this.#bodyLength = 0;
            },
          }),
        );

        handler(part);

        index = headerEndIndex + 4; // Skip header + \r\n\r\n

        this.#state = MultipartParserStateBody;

        continue;
      }

      if (this.#state === MultipartParserStateStart) {
        if (chunkLength < this.#openingBoundaryLength) {
          this.#buffer = chunk;
          break;
        }

        if (this.#findOpeningBoundary(chunk) !== 0) {
          throw new MultipartParseError('Invalid multipart stream: missing initial boundary');
        }

        index = this.#openingBoundaryLength;

        this.#state = MultipartParserStateAfterBoundary;
      }
    }
  }

  #writeBody(chunk: Uint8Array): void {
    if (this.#bodyLength + chunk.length > this.maxFileSize) {
      let error = new MaxFileSizeExceededError(this.maxFileSize);
      this.#bodyController!.error(error);
      throw error;
    }

    this.#bodyController!.enqueue(chunk);
    this.#bodyLength += chunk.length;
  }

  #closeBody(): void {
    this.#bodyController!.close();
    this.#bodyController = null;
  }
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  return typeof value === 'object' && value != null && Symbol.iterator in value;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value != null && Symbol.asyncIterator in value;
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value != null && typeof (value as any).then === 'function';
}

/**
 * A part of a `multipart/*` HTTP message.
 */
export class MultipartPart {
  #header: Uint8Array;
  #body: ReadableStream<Uint8Array>;

  #headers?: Headers;
  #bodyUsed = false;

  constructor(header: Uint8Array, body: ReadableStream<Uint8Array>) {
    this.#header = header;
    this.#body = body;
  }

  /**
   * The content of this part as an `ArrayBuffer`.
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.bytes()).buffer as ArrayBuffer;
  }

  /**
   * The body of this part as a `ReadableStream<Uint8Array>`. In `multipart/form-data` messages, this is useful
   * for streaming the value of files that were uploaded using `<input type="file">` fields.
   */
  get body(): ReadableStream<Uint8Array> {
    return this.#body;
  }

  /**
   * Whether the body of this part has been consumed.
   */
  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  /**
   * The body of this part buffered into a single `Uint8Array`. In `multipart/form-data` messages, this is useful
   * for reading the value of files that were uploaded using `<input type="file">` fields.
   */
  async bytes(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new Error('Body is already consumed or is being consumed');
    }

    this.#bodyUsed = true;

    let chunks: Uint8Array[] = [];
    let totalLength = 0;
    for await (let chunk of readStream(this.#body)) {
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * The headers associated with this part.
   */
  get headers(): Headers {
    if (!this.#headers) {
      this.#headers = new Headers(new TextDecoder().decode(this.#header));
    }

    return this.#headers;
  }

  /**
   * True if this part originated from a file upload.
   */
  get isFile(): boolean {
    return this.filename !== undefined || this.mediaType === 'application/octet-stream';
  }

  /**
   * The filename of the part, if it is a file upload.
   */
  get filename(): string | undefined {
    return this.headers.contentDisposition.preferredFilename;
  }

  /**
   * The media type of the part.
   */
  get mediaType(): string | undefined {
    return this.headers.contentType.mediaType;
  }

  /**
   * The name of the part, usually the `name` of the field in the `<form>` that submitted the request.
   */
  get name(): string | undefined {
    return this.headers.contentDisposition.name;
  }

  /**
   * The body of the part as a string. In `multipart/form-data` messages, this is useful for reading the value
   * of parts that originated from `<input type="text">` fields.
   *
   * Note: Do not use this for binary data, use `await part.bytes()` or stream `part.body` directly instead.
   */
  async text(): Promise<string> {
    return new TextDecoder().decode(await this.bytes());
  }
}
