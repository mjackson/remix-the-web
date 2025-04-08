export type Span = [number, number];
type Split = {
  protocol?: Span;
  hostname?: Span;
  pathname?: Span;
  search?: Span;
};

// todo unit tests

export function split(source: string): Split {
  let index = 0;

  const result: Split = {};
  const protocolEnd = source.indexOf('://');
  if (protocolEnd !== -1) {
    if (protocolEnd !== 0) {
      result.protocol = [0, protocolEnd];
    }
    index = protocolEnd + 3;

    const hostnameEnd = source.indexOf('/', index);
    if (hostnameEnd === -1) {
      result.hostname = [index, source.length];
      return result;
    }
    result.hostname = [index, hostnameEnd];
    index = hostnameEnd + 1;
  }

  const pathnameEnd = source.indexOf('?');
  if (pathnameEnd === -1) {
    result.pathname = [index, source.length];
    return result;
  }
  result.pathname = [index, pathnameEnd];
  index = pathnameEnd + 1;

  result.search = [index, source.length];
  return result;
}
