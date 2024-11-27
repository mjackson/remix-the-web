import { fullyReadBody, isDisturbed } from './util.js';

const textDecoder = new TextDecoder();

/**
 * @param {any} state internal state
 * @param {(value: unknown) => unknown} convertBytesToJSValue
 * @see https://fetch.spec.whatwg.org/#concept-body-consume-body
 */
export async function consumeBody<T>(state: any, convertBytesToJSValue: (value: Buffer) => T) {
  // 1. If object is unusable, then return a promise rejected
  //    with a TypeError.
  if (bodyUnusable(state)) {
    throw new TypeError('Body is unusable: Body has already been read');
  }

  throwIfAborted(state);

  // 2. Let promise be a new promise.
  const promise = createDeferredPromise<T>();

  // 3. Let errorSteps given error be to reject promise with error.
  const errorSteps = (error: any) => promise.reject(error);

  // 4. Let successSteps given a byte sequence data be to resolve
  //    promise with the result of running convertBytesToJSValue
  //    with data. If that threw an exception, then run errorSteps
  //    with that exception.
  const successSteps = (data: Buffer) => {
    try {
      promise.resolve(convertBytesToJSValue(data));
    } catch (e) {
      errorSteps(e);
    }
  };

  // 5. If object’s body is null, then run successSteps with an
  //    empty byte sequence.
  if (state.body == null) {
    successSteps(Buffer.allocUnsafe(0));
    return promise.promise;
  }

  // 6. Otherwise, fully read object’s body given successSteps,
  //    errorSteps, and object’s relevant global object.
  fullyReadBody(state.body, successSteps, errorSteps);

  // 7. Return promise.
  return promise.promise;
}

/**
 * @see https://encoding.spec.whatwg.org/#utf-8-decode
 * @param {Buffer} buffer
 */
export function utf8DecodeBytes(buffer: Buffer) {
  if (buffer.length === 0) {
    return '';
  }

  // 1. Let buffer be the result of peeking three bytes from
  //    ioQueue, converted to a byte sequence.

  // 2. If buffer is 0xEF 0xBB 0xBF, then read three
  //    bytes from ioQueue. (Do nothing with those bytes.)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    buffer = buffer.subarray(3);
  }

  // 3. Process a queue with an instance of UTF-8’s
  //    decoder, ioQueue, output, and "replacement".
  const output = textDecoder.decode(buffer);

  // 4. Return output.
  return output;
}

/**
 * @param {Buffer} bytes
 * @see https://infra.spec.whatwg.org/#parse-json-bytes-to-a-javascript-value
 */
export function parseJSONFromBytes(bytes: Buffer) {
  const json = utf8DecodeBytes(bytes);
  return JSON.parse(json);
}

//#region Helpers

/**
 * @param {any} state internal state
 * @see https://fetch.spec.whatwg.org/#body-unusable
 */
function bodyUnusable(state: any) {
  const body = state.body;

  // An object including the Body interface mixin is
  // said to be unusable if its body is non-null and
  // its body’s stream is disturbed or locked.
  return body != null && (body.stream.locked || isDisturbed(body.stream));
}

function throwIfAborted(state: any) {
  if (state.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function createDeferredPromise<T = unknown>() {
  let _resolve!: (value: T) => void;
  let _reject!: (reason?: any) => void;
  const promise = new Promise<T>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  return {
    promise,
    resolve: _resolve,
    reject: _reject,
  };
}

//#endregion Helpers

//#region Undici: Reference

// function bodyMixinMethods(instance, getInternalState) {
//   const methods = {
//     arrayBuffer() {
//       // The arrayBuffer() method steps are to return the result
//       // of running consume body with this and the following step
//       // given a byte sequence bytes: return a new ArrayBuffer
//       // whose contents are bytes.
//       return consumeBody(
//         this,
//         (bytes) => {
//           return new Uint8Array(bytes).buffer;
//         },
//         instance,
//         getInternalState,
//       );
//     },

//     text() {
//       // The text() method steps are to return the result of running
//       // consume body with this and UTF-8 decode.
//       return consumeBody(this, utf8DecodeBytes, instance, getInternalState);
//     },

//     json() {
//       // The json() method steps are to return the result of running
//       // consume body with this and parse JSON from bytes.
//       return consumeBody(this, parseJSONFromBytes, instance, getInternalState);
//     },

//     formData() {
//       // The formData() method steps are to return the result of running
//       // consume body with this and the following step given a byte sequence bytes:
//       return consumeBody(
//         this,
//         (value) => {
//           // 1. Let mimeType be the result of get the MIME type with this.
//           const mimeType = bodyMimeType(getInternalState(this));

//           // 2. If mimeType is non-null, then switch on mimeType’s essence and run
//           //    the corresponding steps:
//           if (mimeType !== null) {
//             switch (mimeType.essence) {
//               case 'multipart/form-data': {
//                 // 1. ... [long step]
//                 // 2. If that fails for some reason, then throw a TypeError.
//                 const parsed = multipartFormDataParser(value, mimeType);

//                 // 3. Return a new FormData object, appending each entry,
//                 //    resulting from the parsing operation, to its entry list.
//                 const fd = new FormData();
//                 setFormDataState(fd, parsed);

//                 return fd;
//               }
//               case 'application/x-www-form-urlencoded': {
//                 // 1. Let entries be the result of parsing bytes.
//                 const entries = new URLSearchParams(value.toString());

//                 // 2. If entries is failure, then throw a TypeError.

//                 // 3. Return a new FormData object whose entry list is entries.
//                 const fd = new FormData();

//                 for (const [name, value] of entries) {
//                   fd.append(name, value);
//                 }

//                 return fd;
//               }
//             }
//           }

//           // 3. Throw a TypeError.
//           throw new TypeError(
//             'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".',
//           );
//         },
//         instance,
//         getInternalState,
//       );
//     },

//     bytes() {
//       // The bytes() method steps are to return the result of running consume body
//       // with this and the following step given a byte sequence bytes: return the
//       // result of creating a Uint8Array from bytes in this’s relevant realm.
//       return consumeBody(
//         this,
//         (bytes) => {
//           return new Uint8Array(bytes);
//         },
//         instance,
//         getInternalState,
//       );
//     },
//   };

//   return methods;
// }

// #endregion Undici: Reference
