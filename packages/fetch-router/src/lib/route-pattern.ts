import { Params } from './params.js';
import {
  HostnameParamName,
  OptionalHostnameParamName,
  OptionalPathnameParamName,
  PathnameParamName,
  SearchParamName,
} from './route-params.js';
import { SearchParams } from './search-params.js';
import { warning } from './warning.js';

export interface RoutePatternParts {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
}

export interface RoutePatternOptions {
  /**
   * Whether to ignore case when matching the pattern. Defaults to `true`.
   */
  ignoreCase?: boolean;
}

/**
 * A pattern that matches a URL.
 */
export class RoutePattern<T extends string> {
  /**
   * Parses a pattern into its constituent parts.
   * @param pattern The pattern to parse.
   * @returns The parsed pattern.
   */
  static parse(pattern: string): RoutePatternParts {
    return {
      protocol: extractProtocol(pattern),
      hostname: extractHostname(pattern),
      pathname: extractPathname(pattern),
      search: extractSearch(pattern),
    };
  }

  /**
   * Creates a pattern string from its constituent parts.
   * @param parts The parts of the pattern to stringify.
   * @returns The pattern string.
   */
  static stringify(parts: Partial<RoutePatternParts>): string {
    return joinPattern(
      parts.protocol ?? '',
      parts.hostname ?? '',
      parts.pathname ?? '/',
      parts.search ?? '',
    );
  }

  /**
   * The original pattern string.
   */
  readonly source: T;
  /**
   * Whether to ignore case when matching the pattern.
   */
  readonly ignoreCase: boolean;

  #parts: RoutePatternParts | undefined;
  #compiled: { hostnameKeys: string[]; pathnameKeys: string[]; regexp: RegExp } | undefined;

  constructor(source?: T, options?: RoutePatternOptions) {
    this.source = source ?? ('/' as T);
    this.ignoreCase = options?.ignoreCase ?? true;
  }

  get parts(): RoutePatternParts {
    this.#parts ??= RoutePattern.parse(this.source);
    return this.#parts;
  }

  /**
   * Joins this pattern with another and generates a new pattern.
   * @param pattern The pattern to join with this pattern
   * @returns A new pattern
   */
  join<A extends string>(pattern: A | RoutePattern<A>): RoutePattern<JoinPatterns<T, A>> {
    return typeof pattern === 'string'
      ? new RoutePattern(joinPatterns(this.source, pattern) as any, { ignoreCase: this.ignoreCase })
      : new RoutePattern(joinPatterns(this.source, pattern.source) as any, {
          ignoreCase: this.ignoreCase,
        });
  }

  /**
   * Matches this pattern against a URL.
   * @param url The URL to match against.
   * @returns The match if this pattern matches the URL, `null` otherwise.
   */
  match(url: URL): RoutePatternMatch<T> | null {
    this.#compiled ??= compilePattern(this.parts, this.ignoreCase);

    let { hostnameKeys, pathnameKeys, regexp } = this.#compiled;

    // 1) Try to match the origin + pathname first using the precompiled RegExp
    let match = regexp.exec(url.origin + url.pathname);
    if (!match) return null;

    // 2) If that matched, check the search params
    let searchParamsInit = new URLSearchParams();
    let searchPattern = this.parts.search;
    if (searchPattern !== '') {
      let patternSearchParams = new URLSearchParams(searchPattern);
      for (let name of patternSearchParams.keys()) {
        // searchParams.keys() gives us the same key twice when it is repeated
        // in the search string, so skip keys we've already seen
        if (searchParamsInit.has(name)) continue;

        let patternValues = patternSearchParams.getAll(name);
        let urlValues = url.searchParams.getAll(name);

        // An empty source value matches any search value (i.e. ?q matches ?q=*)
        if (patternValues.includes('')) {
          for (let value of urlValues) searchParamsInit.append(name, value);
          continue;
        }

        // Otherwise try to match each literal source value, ignoring extra
        // values for the same query param that may be present in the URL.
        // Important: iterate over the URL values in order here so searchParams
        // are in the same order as the URL's search params.
        for (let value of urlValues) {
          if (patternValues.includes(value)) {
            searchParamsInit.append(name, value);
          } else {
            return null;
          }
        }

        if (!searchParamsInit.has(name)) return null;
      }
    }

    // 3) If both matched, parse params from origin + pathname match
    let paramsInit: [string, string][] = [];
    let captureGroupIndex = 0;

    for (let i = 0; i < hostnameKeys.length; i++) {
      paramsInit.push([hostnameKeys[i], match[++captureGroupIndex]]);
    }

    for (let i = 0; i < pathnameKeys.length; i++) {
      let paramName = pathnameKeys[i];
      paramsInit.push([
        paramName,
        safelyDecodePathnameParam(paramName, match[++captureGroupIndex] || ''),
      ]);
    }

    return new RoutePatternMatch(new Params(paramsInit), new SearchParams(searchParamsInit));
  }

  /**
   * Returns `true` if the this pattern matches the URL, `false` otherwise.
   * @param url The URL to test.
   * @returns Whether the URL matches the pattern.
   */
  test(url: URL): boolean {
    return this.match(url) !== null;
  }

  toString(): string {
    return this.source;
  }
}

function compilePattern(
  { protocol, hostname, pathname }: RoutePatternParts,
  ignoreCase: boolean,
): {
  hostnameKeys: string[];
  pathnameKeys: string[];
  regexp: RegExp;
} {
  let hostnameKeys: string[] = [];
  let pathnameKeys: string[] = [];
  let regexpSource = '^';

  // protocol supports static strings, e.g. "http:" or "https:"
  regexpSource += (protocol !== '' ? protocol : '\\w+:') + '//';

  // hostname supports static string segments, dynamic :params, optional segments, and wildcards
  if (hostname !== '') {
    let hostnameSegments = hostname.split('.');
    for (let i = 0; i < hostnameSegments.length; i++) {
      let segment = hostnameSegments[i];
      let isOptional = segment.endsWith('?');

      if (isOptional) {
        segment = segment.slice(0, -1);
        regexpSource += '(?:';
      }

      if (segment.startsWith(':')) {
        hostnameKeys.push(segment.slice(1));
        regexpSource += '([a-zA-Z0-9^-]+)';
      } else if (segment === '*') {
        hostnameKeys.push('*');
        regexpSource += '([a-zA-Z0-9^-]+)';
      } else {
        regexpSource += escapeRegExpSpecialChars(segment);
      }

      if (i < hostnameSegments.length - 1) {
        regexpSource += '\\.';
      }

      if (isOptional) regexpSource += ')?';
    }
  } else {
    regexpSource += '[^/]+';
  }

  // pathname supports static string segments, dynamic :params, optional segments, and wildcards
  let pathnameSegments = pathname.slice(1).split('/');

  // When every segment is optional, we still need to match the
  // root / in case none of them match.
  let pathnameIsOptional = pathnameSegments.every((segment) => segment.endsWith('?'));
  if (pathnameIsOptional) regexpSource += '(?:';

  for (let i = 0; i < pathnameSegments.length; i++) {
    let segment = pathnameSegments[i];
    let isOptional = segment.endsWith('?');

    if (isOptional) {
      segment = segment.slice(0, -1);
      regexpSource += '(?:';
    }

    if (segment.startsWith(':')) {
      pathnameKeys.push(segment.slice(1));
      regexpSource += '/([^/]+)';
    } else if (segment === '*') {
      pathnameKeys.push('*');
      if (i < pathnameSegments.length - 1) {
        regexpSource += '/([^/]*)'; // wildcard in the middle of the pathname
      } else {
        regexpSource += '/(.*)'; // wildcard at the end of the pathname
      }
    } else {
      regexpSource += '/' + escapeRegExpSpecialChars(segment);
    }

    if (isOptional) regexpSource += ')?';
  }

  if (pathnameIsOptional) regexpSource += ')|/';

  regexpSource += '$';

  let regexp = new RegExp(regexpSource, ignoreCase ? 'i' : undefined);

  return {
    hostnameKeys,
    pathnameKeys,
    regexp,
  };
}

function escapeRegExpSpecialChars(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safelyDecodePathnameParam(paramName: string, value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    warning(
      false,
      `The value for URL param "${paramName}" will not be decoded because` +
        ` the string "${value}" is a malformed URL segment. This is probably` +
        ` due to a bad percent encoding (${error}).`,
    );

    return value;
  }
}

export type RoutePatternParams<T extends string> = RoutePatternParams_<
  ExtractHostname<T>,
  ExtractPathname<T>
>;

type RoutePatternParams_<H extends string, P extends string> = Params<
  HostnameParamName<H> | PathnameParamName<P>,
  OptionalHostnameParamName<H> | OptionalPathnameParamName<P>
>;

export type RoutePatternSearchParams<T extends string> = SearchParams<
  SearchParamName<ExtractSearch<T>>
>;

/**
 * Contains information about the params and searchParams that were found in the URL.
 */
export class RoutePatternMatch<T extends string> {
  /**
   * The matched params found in the URL hostname and pathname.
   */
  params: RoutePatternParams<T>;
  /**
   * The matched search params found in the URL search/query string.
   */
  searchParams: RoutePatternSearchParams<T>;

  constructor(params: Params, searchParams: SearchParams) {
    this.params = params;
    this.searchParams = searchParams;
  }
}

//#region EXTRACT helpers
// prettier-ignore
export type ExtractProtocol<T extends string> =
  T extends `${infer L}://${string}` ?
	  L extends '' ? '' :
		`${L}:` :
	''

export function extractProtocol(input: string): string {
  if (input.includes('://')) {
    let left = input.split('://')[0];
    return left === '' ? '' : `${left}:`;
  }
  return '';
}

// prettier-ignore
export type ExtractHostname<T extends string> =
  T extends `${string}://${infer R}` ? ExtractHostname_<R> : ''

// prettier-ignore
type ExtractHostname_<T extends string> =
  T extends `${infer L}??` ? ExtractHostname_<`${L}?`> : // remix.run??
  T extends `${infer L}/?` ? ExtractHostname_<L> : // remix.run/?
  T extends `${infer L}/${string}` ? ExtractHostname_<L> : // remix.run/
  T extends `${infer L}?${infer R}` ?
    R extends '' ? `${L}?` : // remix.run?
    R extends `.${string}` ? `${L}?${ExtractHostname_<R>}` : // www?.remix.run
    R extends `?${string}` ? `${L}?` : // remix.run??q
    L : // remix.run?q
  T

export function extractHostname(input: string): string {
  let index = input.indexOf('://');
  return index !== -1 ? extractHostname_(input.slice(index + 3)) : '';
}

function extractHostname_(input: string): string {
  if (input.endsWith('??')) return extractHostname_(input.slice(0, -1)); // remix.run??
  if (input.endsWith('/?')) return extractHostname_(input.slice(0, -1)); // remix.run/?
  if (input.includes('/')) return extractHostname_(input.split('/')[0]); // remix.run/
  if (input.includes('?')) {
    let index = input.indexOf('?');
    let left = input.slice(0, index);
    let right = input.slice(index + 1);
    if (right === '') return `${left}?`; // remix.run?
    if (right.startsWith('.')) return `${left}?${extractHostname_(right)}`; // www?.remix.run
    if (right.startsWith('?')) return `${left}?`; // remix.run??q
    return left; // remix.run?q
  }
  return input;
}

// prettier-ignore
type ExtractPathnameAndSearch<T extends string> =
  T extends `${string}://${ExtractHostname<T>}${infer R}` ? R : T

function extractPathnameAndSearch(input: string): string {
  let index = input.indexOf('://');
  if (index === -1) return input;
  let hostname = extractHostname_(input.slice(index + 3));
  return input.slice(index + 3 + hostname.length);
}

// To disambiguate ? that is an optional pathname param from the start of a
// search string, we use the following heuristics:
//
// /a/b/c       -> /c is not optional, no search
// /a/b?/c      -> /b is optional, no search
// /a/b/c?      -> /c is optional, no search
// /a/b/c?q     -> /c is not optional, search is ?q
// /a/b/c?q=1   -> /c is not optional, search is ?q=1
// /a/b/c??q=1  -> /c is optional, search is ?q=1
// /a/b/c??     -> /c is optional, search is empty (ignored)

// prettier-ignore
export type ExtractPathname<T extends string> =
  T extends `${string}://${string}` ? ExtractPathname_<ExtractPathnameAndSearch<T>> : // http://...
  ExtractPathname_<T>

// prettier-ignore
type ExtractPathname_<T extends string> =
  T extends `${infer L}??` ? ExtractPathname_<`${L}?`> : // /a/b/c??
  T extends `${infer L}/?` ? ExtractPathname_<`${L}/`> : // /a/b/c/?
  T extends `${infer L}?${infer R}` ?
    R extends '' ? NormalizePathname<`${L}?`> : // /a/b/c?
		R extends `/${string}` ? `${NormalizePathname<L>}?${ExtractPathname_<R>}` : // /a/b?/c
		R extends `?${string}` ? NormalizePathname<`${L}?`> : // /a/b/c??q
    NormalizePathname<L> : // /a/b/c?q
  NormalizePathname<T>

export function extractPathname(input: string): string {
  if (input.includes('://')) return extractPathname(extractPathnameAndSearch(input)); // http://...
  if (input.endsWith('??')) return extractPathname(input.slice(0, -1)); // /a/b/c??
  if (input.endsWith('/?')) return extractPathname(input.slice(0, -1)); // /a/b/c/?
  if (input.includes('?')) {
    let index = input.indexOf('?');
    let left = input.slice(0, index);
    let right = input.slice(index + 1);
    if (right === '') return normalizePathname(`${left}?`); // /a/b/c?
    if (right.startsWith('/')) return `${normalizePathname(left)}?${extractPathname(right)}`; // /a/b?/c
    if (right.startsWith('?')) return normalizePathname(`${left}?`); // /a/b/c??q
    return normalizePathname(left); // /a/b/c?q
  }
  return normalizePathname(input);
}

type NormalizePathname<T extends string> = T extends `/${string}` ? T : `/${T}`;

function normalizePathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

// prettier-ignore
export type ExtractSearch<T extends string> =
  T extends `${string}://${string}` ? ExtractSearch_<ExtractPathnameAndSearch<T>> : // http://...
  ExtractSearch_<T>

// prettier-ignore
type ExtractSearch_<T extends string> =
	T extends `${string}/?${infer R}` ? `?${R}` : // /a/b/c/?
  T extends `${string}?${infer R}` ?
    R extends '' ? '' : // /a/b/c?
    R extends `/${string}` ? ExtractSearch_<R> : // /a/b?/c
		R extends `?${string}` ? R : // /a/b/c??q
		`?${R}` : // /a/b/c?q
  ''

export function extractSearch(input: string): string {
  if (input.includes('://')) return extractSearch(extractPathnameAndSearch(input)); // http://...
  if (input.includes('/?')) return input.slice(input.indexOf('/?') + 1); // /a/b/c/?
  if (input.includes('?')) {
    let index = input.indexOf('?');
    let right = input.slice(index + 1);
    if (right === '') return ''; // /a/b/c?
    if (right.startsWith('/')) return extractSearch(right); // /a/b?/c
    if (right.startsWith('?')) return right; // /a/b/c??q
    return `?${right}`; // /a/b/c?q
  }
  return '';
}
//#endregion

//#region JOIN helpers
export type JoinPatterns<E extends string, A extends string> = JoinPattern<
  JoinProtocol<ExtractProtocol<E>, ExtractProtocol<A>>,
  JoinHostname<ExtractHostname<E>, ExtractHostname<A>>,
  JoinPathname<ExtractPathname<E>, ExtractPathname<A>>,
  JoinSearch<ExtractSearch<E>, ExtractSearch<A>>
>;

export function joinPatterns(existing: string, additional: string): string {
  return joinPattern(
    joinProtocol(extractProtocol(existing), extractProtocol(additional)),
    joinHostname(extractHostname(existing), extractHostname(additional)),
    joinPathname(extractPathname(existing), extractPathname(additional)),
    joinSearch(extractSearch(existing), extractSearch(additional)),
  );
}

// prettier-ignore
export type JoinPattern<
  Protocol extends string,
  Hostname extends string,
  Pathname extends string,
  Search extends string,
> = Hostname extends '' ? `${Pathname}${Search}` :
    Protocol extends '' ? `://${Hostname}${Pathname}${Search}` :
    `${Protocol}//${Hostname}${Pathname}${Search}`

export function joinPattern(
  protocol: string,
  hostname: string,
  pathname: string,
  search: string,
): string {
  // prettier-ignore
  return (
    hostname === '' ? `${pathname}${search}` :
    protocol === '' ? `://${hostname}${pathname}${search}` :
    `${protocol}//${hostname}${pathname}${search}`
  );
}

export type JoinProtocol<E extends string, A extends string> = A extends `` ? E : A;

export function joinProtocol(existingProtocol: string, additionalProtocol: string): string {
  return additionalProtocol || existingProtocol;
}

export type JoinHostname<E extends string, A extends string> = A extends `` ? E : A;

export function joinHostname(existingHostname: string, additionalHostname: string): string {
  return additionalHostname || existingHostname;
}

// prettier-ignore
export type JoinPathname<E extends string, A extends string> =
  A extends '/' ? E :
	E extends `${infer L}/` ? `${L}${A}` :
	`${E}${A}`

export function joinPathname(existingPathname: string, additionalPathname: string): string {
  // prettier-ignore
  return (
		additionalPathname === '/' ? existingPathname :
		// Strip trailing slash from parent pathname before appending child pathname.
		existingPathname.endsWith('/') ? existingPathname.slice(0, -1) + additionalPathname :
		existingPathname + additionalPathname
	)
}

// prettier-ignore
export type JoinSearch<E extends string, A extends string> =
	SearchString<[...SearchPairs<E>, ...SearchPairs<A>]>

export function joinSearch(existingSearch: string, additionalSearch: string): string {
  return searchString([...searchPairs(existingSearch), ...searchPairs(additionalSearch)]);
}
//#endregion

//#region SEARCH helpers
type SearchString<T extends SearchPair[]> = SearchString_<SearchPairsString<T>>;
type SearchString_<T extends string> = T extends '' ? '' : `?${T}`;

// prettier-ignore
type SearchPairsString<T extends SearchPair[]> =
	T extends [infer L extends SearchPair, ...infer R extends SearchPair[]] ?
	  R extends [] ?
		  SearchPairString<L> :
			`${SearchPairString<L>}&${SearchPairsString<R>}` :
		''

type SearchPairString<T extends SearchPair> = T[1] extends '' ? T[0] : `${T[0]}=${T[1]}`;

function searchString(pairs: SearchPair[]) {
  let str = pairs.map((pair) => (pair[1] === '' ? pair[0] : pair.join('='))).join('&');
  return str === '' ? '' : `?${str}`;
}

// prettier-ignore
type SearchPairs<T extends string> =
	T extends `` ? [] :
	T extends `?${infer R}` ? SearchPairs<R> :
  T extends `${infer L}&${infer R}` ? [...SearchPairs<L>, ...SearchPairs<R>] :
	T extends `${infer L}=${infer R}` ? [[L, R]] :
	[[T, '']]

type SearchPair = [string, string];

function searchPairs(search: string): SearchPair[] {
  // prettier-ignore
  return (
		search === '' ? [] :
		search.startsWith('?') ? searchPairs(search.slice(1)) :
		search
		  .split('&')
		  .map(pair => pair.split('='))
			.map(([key, value]) => value === undefined ? [key, ''] : [key, value])
	)
}
//#endregion
