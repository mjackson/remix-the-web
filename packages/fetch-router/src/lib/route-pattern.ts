import { Params } from './params.ts';
import type {
  ExtractProtocol,
  ExtractHostname,
  ExtractPathname,
  ExtractSearch,
  JoinProtocol,
  JoinHostname,
  JoinPathname,
  JoinSearch,
} from './route-pattern-helpers.ts';
import {
  extractProtocol,
  extractHostname,
  extractPathname,
  extractSearch,
  joinProtocol,
  joinHostname,
  joinPathname,
  joinSearch,
} from './route-pattern-helpers.ts';
import type { RoutePatternParams, RoutePatternSearchParams } from './route-pattern-params.ts';
import { SearchParams } from './search-params.ts';
import { warning } from './warning.ts';

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
//#endregion
