type Split = {
  protocol?: string;
  hostname?: string;
  pathname?: string;
  search?: string;
};
export function split(source: string): Split {
  const spans = splitIntoSpans(source);
  const result: Split = {};
  if (spans.protocol) result.protocol = source.slice(...spans.protocol);
  if (spans.hostname) result.hostname = source.slice(...spans.hostname);
  if (spans.pathname) result.pathname = source.slice(...spans.pathname);
  if (spans.search) result.search = source.slice(...spans.search);
  return result;
}

export type Span = [number, number];

type SplitSpans = {
  protocol?: Span;
  hostname?: Span;
  pathname?: Span;
  search?: Span;
};

export function splitIntoSpans(source: string): SplitSpans {
  let index = 0;

  const result: SplitSpans = {};
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
