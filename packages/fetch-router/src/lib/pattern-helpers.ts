import { String } from 'ts-toolbelt';

//#region EXTRACT helpers
// The EXTRACT helpers are used to extract protocol, hostname, pathname and search from a
// string RoutePatternInput.

// prettier-ignore
export type ExtractProtocol<T extends string> =
  T extends `${infer L}://${string}` ?
	  L extends `` ? `` :
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
  T extends `${string}://${infer R}` ? String.Split<R, '/'>[0] : ''

export function extractHostname(input: string): string {
  return input.includes('://') ? input.split('://')[1].split('/')[0] : '';
}

// prettier-ignore
type ExtractPathnameAndSearch<T extends string> =
  T extends `${string}://${ExtractHostname<T>}${infer R}` ? R : T

function extractPathnameAndSearch(input: string): string {
  if (input.includes('://')) {
    let right = input.split('://')[1];
    return right.includes('/') ? right.slice(right.indexOf('/')) : '';
  }
  return input;
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
  T extends `${string}://${string}` ? ExtractPathname<ExtractPathnameAndSearch<T>> : // http://...
  T extends `${infer L}??` ? ExtractPathname<`${L}?`> : // /a/b/c??
  T extends `${infer L}/?` ? ExtractPathname<`${L}/`> : // /a/b/c/?
  T extends `${infer L}?${infer R}` ?
    R extends `` ? `${L}?` : // /a/b/c?
		R extends `/${string}` ? `${L}?${ExtractPathname<R>}` : // /a/b?/c
		R extends `?${string}` ? ExtractPathname<`${L}?`> : // /a/b/c??q
    L : // /a/b/c?q
  T

export function extractPathname(input: string): string {
  if (input.includes('://')) return extractPathname(extractPathnameAndSearch(input)); // http://...
  if (input.endsWith('??')) return extractPathname(input.slice(0, -1)); // /a/b/c??
  if (input.endsWith('/?')) return extractPathname(input.slice(0, -1)); // /a/b/c/?
  if (input.includes('?')) {
    let index = input.indexOf('?');
    let left = input.slice(0, index);
    let right = input.slice(index + 1);
    if (right === '') return `${left}?`; // /a/b/c?
    if (right.startsWith('/')) return `${left}?${extractPathname(right)}`; // /a/b?/c
    if (right.startsWith('?')) return extractPathname(`${left}?`); // /a/b/c??q
    return left; // /a/b/c?q
  }
  return input;
}

// prettier-ignore
export type ExtractSearch<T extends string> =
  T extends `${string}://${string}` ? ExtractSearch<ExtractPathnameAndSearch<T>> : // http://...
	T extends `${string}/?${infer R}` ? `?${R}` : // /a/b/c/?
  T extends `${string}?${infer R}` ?
    R extends `` ? '' : // /a/b/c?
    R extends `/${string}` ? ExtractSearch<R> : // /a/b?/c
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

//#region NORMALIZE helpers
// prettier-ignore
export type NormalizeProtocol<T extends string> =
	Lowercase<T extends `` ? `` : T extends `${string}:` ? T : `${T}:`>

export function normalizeProtocol(protocol: string): string {
  return protocol === '' ? '' : (protocol.endsWith(':') ? protocol : `${protocol}:`).toLowerCase();
}

export type NormalizeHostname<T extends string> = Lowercase<T>;

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase();
}

// prettier-ignore
export type NormalizePathname<T extends string> =
  T extends `` ? `/` :
	T extends `/${string}` ? T :
	`/${T}` // TODO: normalize .. and . segments

export function normalizePathname(pathname: string): string {
  let rawSegments = pathname.split('/');

  let segments: string[] = [];
  for (let segment of rawSegments) {
    if (segment === '..') {
      segments.pop();
    } else if (segment !== '.') {
      segments.push(segment);
    }
  }

  let joined = segments.join('/');

  if (pathname.endsWith('/') && !joined.endsWith('/')) {
    joined += '/';
  }

  return joined.startsWith('/') ? joined : `/${joined}`;
}

// prettier-ignore
export type NormalizeSearch<T extends string> =
  SearchString<SearchPairs<T>>

export function normalizeSearch(search: string): string {
  return searchString(searchPairs(search));
}
//#endregion

//#region JOIN helpers
export type Join<E extends string, A extends string> = Join_<
  JoinProtocol<ExtractProtocol<E>, ExtractProtocol<A>>,
  JoinHostname<ExtractHostname<E>, ExtractHostname<A>>,
  JoinPathname<ExtractPathname<E>, ExtractPathname<A>>,
  JoinSearch<ExtractSearch<E>, ExtractSearch<A>>
>;

// prettier-ignore
type Join_<
  Protocol extends string,
  Hostname extends string,
  Pathname extends string,
  Search extends string,
> = Hostname extends '' ? `${Pathname}${Search}` :
    Protocol extends '' ? `https://${Hostname}${Pathname}${Search}` :
    `${Protocol}//${Hostname}${Pathname}${Search}`

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

type SearchString<T extends SearchPair[]> = SearchString_<SearchPairsString<T>>;
type SearchString_<T extends string> = T extends '' ? '' : `?${T}`;

// prettier-ignore
type SearchPairsString<T extends SearchPair[]> =
	T extends [infer L extends SearchPair, ...infer R extends SearchPair[]] ?
	  R extends [] ?
		  SearchPairString<L> :
			String.Join<[SearchPairString<L>, SearchPairsString<R>], '&'> :
		''

type SearchPairString<T extends string[]> = T[1] extends '' ? T[0] : String.Join<T, '='>;

function searchString(pairs: SearchPair[]) {
  let str = pairs.map((pair) => (pair[1] === '' ? pair[0] : pair.join('='))).join('&');
  return str === '' ? '' : `?${str}`;
}
//#endregion
