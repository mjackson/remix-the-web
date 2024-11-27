import { Readable } from 'stream';
import { isUint8Array } from 'node:util/types';

import { kBodyUsed } from './symbols.js';

/**
 * A body is disturbed if it has been read from and it cannot be re-used without
 * losing state or data.
 *
 * @param {stream.Readable} body The body to check.
 * @returns {boolean}
 */
export function isDisturbed(body: Readable & { [kBodyUsed]?: boolean }): boolean {
  // TODO (fix): Why is body[kBodyUsed] needed?
  return !!(body && (Readable.isDisturbed(body) || body[kBodyUsed]));
}

/**
 * @see https://fetch.spec.whatwg.org/#body-fully-read
 */
export function fullyReadBody(
  body: { stream: { getReader: () => any } },
  processBody: any,
  processBodyError: any,
) {
  // 1. If taskDestination is null, then set taskDestination to
  //    the result of starting a new parallel queue.

  // 2. Let successSteps given a byte sequence bytes be to queue a
  //    fetch task to run processBody given bytes, with taskDestination.
  const successSteps = processBody;

  // 3. Let errorSteps be to queue a fetch task to run processBodyError,
  //    with taskDestination.
  const errorSteps = processBodyError;

  // 4. Let reader be the result of getting a reader for body’s stream.
  //    If that threw an exception, then run errorSteps with that
  //    exception and return.
  let reader;

  try {
    reader = body.stream.getReader();
  } catch (e) {
    errorSteps(e);
    return;
  }

  // 5. Read all bytes from reader, given successSteps and errorSteps.
  readAllBytes(reader, successSteps, errorSteps);
}

/**
 * @param {URL} url
 * @param {boolean} excludeFragment
 * @see {@link https://url.spec.whatwg.org/#concept-url-serializer}
 */
export function serializeUrl(url: URL, excludeFragment: boolean = false) {
  if (!excludeFragment) {
    return url.href;
  }

  const href = url.href;
  const hashLength = url.hash.length;

  const serialized = hashLength === 0 ? href : href.substring(0, href.length - hashLength);

  if (!hashLength && href.endsWith('#')) {
    return serialized.slice(0, -1);
  }

  return serialized;
}

//#region Helpers

/**
 * @see https://streams.spec.whatwg.org/#readablestreamdefaultreader-read-all-bytes
 * @see https://streams.spec.whatwg.org/#read-loop
 * @param {ReadableStreamDefaultReader} reader
 * @param {(bytes: Uint8Array) => void} successSteps
 * @param {(error: Error) => void} failureSteps
 */
async function readAllBytes(
  reader: ReadableStreamDefaultReader,
  successSteps: (bytes: Uint8Array) => void,
  failureSteps: (error: Error) => void,
) {
  const bytes = [];
  let byteLength = 0;

  try {
    do {
      const { done, value: chunk } = await reader.read();

      if (done) {
        // 1. Call successSteps with bytes.
        successSteps(Buffer.concat(bytes, byteLength));
        return;
      }

      // 1. If chunk is not a Uint8Array object, call failureSteps
      //    with a TypeError and abort these steps.
      if (!isUint8Array(chunk)) {
        failureSteps(TypeError('Received non-Uint8Array chunk'));
        return;
      }

      // 2. Append the bytes represented by chunk to bytes.
      bytes.push(chunk);
      byteLength += chunk.length;

      // 3. Read-loop given reader, bytes, successSteps, and failureSteps.
    } while (true);
  } catch (e: any) {
    // 1. Call failureSteps with e.
    failureSteps(e);
  }
}

//#endregion Helpers

//#region node:http compat

/**
 * Matches a given field name to a known field and returns a corresponding string.
 * If the field is not recognized, it will return the field name prefixed with a null character.
 *
 * Original description from `node:http`:
 *
 * > This function is used to help avoid the lowercasing of a field name if it
 * > matches a 'traditional cased' version of a field name. It then returns the
 * > lowercased name to both avoid calling toLowerCase() a second time and to
 * > indicate whether the field was a 'no duplicates' field. If a field is not a
 * > 'no duplicates' field, a `0` byte is prepended as a flag. The one exception
 * > to this is the Set-Cookie header which is indicated by a `1` byte flag, since
 * > it is an 'array' field and thus is treated differently in _addHeaderLines().
 * > TODO: perhaps http_parser could be returning both raw and lowercased versions
 * > of known header names to avoid us having to call toLowerCase() for those
 * > headers.
 *
 * @param field - The field name to match.
 * @param lowercased - A boolean indicating if the field name has already been lowercased.
 * @returns A string representing the matched known field or the field name prefixed with a null character.
 */
export function matchKnownFields(field: string, lowercased = false) {
  switch (field.length) {
    case 3:
      if (field === 'Age' || field === 'age') return 'age';
      break;
    case 4:
      if (field === 'Host' || field === 'host') return 'host';
      if (field === 'From' || field === 'from') return 'from';
      if (field === 'ETag' || field === 'etag') return 'etag';
      if (field === 'Date' || field === 'date') return '\u0000date';
      if (field === 'Vary' || field === 'vary') return '\u0000vary';
      break;
    case 6:
      if (field === 'Server' || field === 'server') return 'server';
      if (field === 'Cookie' || field === 'cookie') return '\u0002cookie';
      if (field === 'Origin' || field === 'origin') return '\u0000origin';
      if (field === 'Expect' || field === 'expect') return '\u0000expect';
      if (field === 'Accept' || field === 'accept') return '\u0000accept';
      break;
    case 7:
      if (field === 'Referer' || field === 'referer') return 'referer';
      if (field === 'Expires' || field === 'expires') return 'expires';
      if (field === 'Upgrade' || field === 'upgrade') return '\u0000upgrade';
      break;
    case 8:
      if (field === 'Location' || field === 'location') return 'location';
      if (field === 'If-Match' || field === 'if-match') return '\u0000if-match';
      break;
    case 10:
      if (field === 'User-Agent' || field === 'user-agent') return 'user-agent';
      if (field === 'Set-Cookie' || field === 'set-cookie') return '\u0001';
      if (field === 'Connection' || field === 'connection') return '\u0000connection';
      break;
    case 11:
      if (field === 'Retry-After' || field === 'retry-after') return 'retry-after';
      break;
    case 12:
      if (field === 'Content-Type' || field === 'content-type') return 'content-type';
      if (field === 'Max-Forwards' || field === 'max-forwards') return 'max-forwards';
      break;
    case 13:
      if (field === 'Authorization' || field === 'authorization') return 'authorization';
      if (field === 'Last-Modified' || field === 'last-modified') return 'last-modified';
      if (field === 'Cache-Control' || field === 'cache-control') return '\u0000cache-control';
      if (field === 'If-None-Match' || field === 'if-none-match') return '\u0000if-none-match';
      break;
    case 14:
      if (field === 'Content-Length' || field === 'content-length') return 'content-length';
      break;
    case 15:
      if (field === 'Accept-Encoding' || field === 'accept-encoding')
        return '\u0000accept-encoding';
      if (field === 'Accept-Language' || field === 'accept-language')
        return '\u0000accept-language';
      if (field === 'X-Forwarded-For' || field === 'x-forwarded-for')
        return '\u0000x-forwarded-for';
      break;
    case 16:
      if (field === 'Content-Encoding' || field === 'content-encoding')
        return '\u0000content-encoding';
      if (field === 'X-Forwarded-Host' || field === 'x-forwarded-host')
        return '\u0000x-forwarded-host';
      break;
    case 17:
      if (field === 'If-Modified-Since' || field === 'if-modified-since')
        return 'if-modified-since';
      if (field === 'Transfer-Encoding' || field === 'transfer-encoding')
        return '\u0000transfer-encoding';
      if (field === 'X-Forwarded-Proto' || field === 'x-forwarded-proto')
        return '\u0000x-forwarded-proto';
      break;
    case 19:
      if (field === 'Proxy-Authorization' || field === 'proxy-authorization')
        return 'proxy-authorization';
      if (field === 'If-Unmodified-Since' || field === 'if-unmodified-since')
        return 'if-unmodified-since';
      break;
  }

  if (lowercased) {
    return '\u0000' + field;
  }

  return matchKnownFields(field.toLowerCase(), true);
}

export function onError(self: any, error: any, cb: (err?: Error) => void) {
  // This is to keep backward compatible behavior.
  // An error is emitted only if there are listeners attached to the event.
  if (self.listenerCount('error') === 0) {
    cb();
  } else {
    cb(error);
  }
}

//#endregion node:http compat
