/**
 * Splits a route pattern into protocol, hostname, pathname, and search parts.
 */
export function splitPattern<T extends string>(pattern: T): SplitPattern<T> {
  let parts: string[] = [];

  let index = pattern.indexOf('://');
  let rest: string;
  if (index !== -1) {
    parts.push(normalizeProtocol(pattern.slice(0, index)));

    let pathIndex = pattern.indexOf('/', index + 3);
    if (pathIndex !== -1) {
      parts.push(pattern.slice(index + 3, pathIndex));
      rest = pattern.slice(pathIndex);
    } else {
      let searchIndex = pattern.indexOf('?', index + 3);
      if (searchIndex !== -1) {
        parts.push(pattern.slice(index + 3, searchIndex));
        rest = pattern.slice(searchIndex);
      } else {
        parts.push(pattern.slice(index + 3), '/', '');
        return parts as SplitPattern<T>;
      }
    }
  } else {
    parts.push('', '');
    rest = pattern;
  }

  let searchIndex = rest.indexOf('?');
  if (searchIndex !== -1) {
    parts.push(
      normalizePathname(rest.slice(0, searchIndex)),
      normalizeSearch(rest.slice(searchIndex + 1)),
    );
  } else {
    parts.push(normalizePathname(rest), '');
  }

  return parts as SplitPattern<T>;
}

function normalizeProtocol(protocol: string): string {
  return protocol === '' ? '' : `${protocol}:`;
}

function normalizePathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function normalizeSearch(search: string): string {
  return search === '' ? '' : `?${search}`;
}

// prettier-ignore
export type SplitPattern<P extends string> =
  P extends `${infer Protocol}://${infer R}` ?
    R extends `${infer Hostname}/${infer R}` ?
      R extends `${infer Pathname}?${infer Search}` ?
        [NormalizeProtocol<Protocol>, Hostname, `/${Pathname}`, NormalizeSearch<Search>] :
        [NormalizeProtocol<Protocol>, Hostname, `/${R}`, ''] :
    R extends `${infer Hostname}?${infer Search}` ?
      [NormalizeProtocol<Protocol>, Hostname, '/', NormalizeSearch<Search>] :
      [NormalizeProtocol<Protocol>, R, '/', ''] :
  P extends `${infer Pathname}?${infer Search}`
    ? ['', '', NormalizePathname<Pathname>, NormalizeSearch<Search>]
    : ['', '', NormalizePathname<P>, ''];

type NormalizeProtocol<P extends string> = P extends '' ? P : `${P}:`;
type NormalizePathname<P extends string> = P extends `/${string}` ? P : `/${P}`;
type NormalizeSearch<S extends string> = S extends '' ? S : `?${S}`;

/**
 * Combines the protocol, hostname, pathname, and search parts into a route pattern.
 */
export function joinPattern<T extends [string, string, string, string]>([
  protocol,
  hostname,
  pathname,
  search,
]: T): JoinPattern<T> {
  // prettier-ignore
  return (
    hostname === '' ?
      `${pathname}${search}` :
      protocol === '' ?
        `://${hostname}${pathname}${search}` :
        `${protocol}//${hostname}${pathname}${search}`
  ) as JoinPattern<T>;
}

// prettier-ignore
export type JoinPattern<P extends [string, string, string, string]> =
  P extends [infer Protocol extends string, infer Hostname extends string, infer Pathname extends string, infer Search extends string] ?
    Hostname extends '' ?
      `${Pathname}${Search}` :
      Protocol extends '' ?
        `://${Hostname}${Pathname}${Search}` :
        `${Protocol}//${Hostname}${Pathname}${Search}` :
    never;
