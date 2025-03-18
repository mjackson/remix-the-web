type Split = {
  protocol?: string;
  hostname?: string;
  pathname?: string;
  search?: string;
};
const split = (pattern: string): Split => {
  let index = 0;
  const result: Split = {};

  const protocolEnd = pattern.indexOf('://');
  if (protocolEnd !== -1) {
    result.protocol = protocolEnd === 0 ? undefined : pattern.slice(0, protocolEnd);
    index = protocolEnd + 3;

    const hostnameEnd = pattern.indexOf('/', index);
    if (hostnameEnd !== -1) {
      result.hostname = pattern.slice(index, hostnameEnd);
      index = hostnameEnd + 1;
    }
  }

  const pathnameEnd = pattern.indexOf('?');
  if (pathnameEnd !== -1) {
    result.pathname = pattern.slice(index, pathnameEnd);
    index = pathnameEnd + 1;

    result.search = pattern.slice(index);
  }
  return result;
};

/*
Pattern <- ((Protocol) '://' Hostname '/') Pathname ('?' Search)
*/
