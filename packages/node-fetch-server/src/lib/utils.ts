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

export function internalServerError(): Response {
  return new Response(
    // "Internal Server Error"
    new Uint8Array([
      73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111,
      114,
    ]),
    {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    },
  );
}
