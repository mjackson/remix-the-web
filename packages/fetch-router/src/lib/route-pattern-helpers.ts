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
