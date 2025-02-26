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
  T extends `${infer L}/${string}` ? L : // remix.run/
  T extends `${infer L}?${string}` ? L : // remix.run?
  T

export function extractHostname(input: string): string {
  let index = input.indexOf('://');
  return index !== -1 ? extractHostname_(input.slice(index + 3)) : '';
}

function extractHostname_(input: string): string {
  if (input.includes('/')) return input.split('/')[0]; // remix.run/
  if (input.includes('?')) return input.split('?')[0]; // remix.run?
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

// prettier-ignore
export type ExtractPathname<T extends string> =
  T extends `${string}://${string}` ? ExtractPathname_<ExtractPathnameAndSearch<T>> : // http://...
  ExtractPathname_<T>

type ExtractPathname_<T extends string> = NormalizePathname<
  T extends `${infer L}?${string}` ? L : T
>;

export function extractPathname(input: string): string {
  if (input.includes('://')) return extractPathname(extractPathnameAndSearch(input)); // http://...
  if (input.includes('?')) return normalizePathname(input.slice(0, input.indexOf('?')));
  return normalizePathname(input);
}

// prettier-ignore
type NormalizePathname<T extends string> =
  T extends `/${string}` ? T :
  T extends `(/${string}` ? T :
  `/${T}`;

function normalizePathname(pathname: string): string {
  return pathname.startsWith('/') || pathname.startsWith('(/') ? pathname : `/${pathname}`;
}

// prettier-ignore
export type ExtractSearch<T extends string> =
  T extends `${string}://${string}` ? ExtractSearch_<ExtractPathnameAndSearch<T>> : // http://...
  ExtractSearch_<T>

// prettier-ignore
type ExtractSearch_<T extends string> =
  T extends `${string}?${infer R}` ?
    R extends '' ? '' : // /a/b/c?
		`?${R}` : // /a/b/c?q
  ''

export function extractSearch(input: string): string {
  if (input.includes('://')) return extractSearch(extractPathnameAndSearch(input)); // http://...
  if (input.includes('?')) {
    let index = input.indexOf('?');
    let right = input.slice(index + 1);
    if (right === '') return ''; // /a/b/c?
    return `?${right}`; // /a/b/c?q
  }
  return '';
}
//#endregion

//#region JOIN helpers
export type JoinProtocol<A extends string, B extends string> = B extends `` ? A : B;

export function joinProtocol(a: string, b: string): string {
  return b === '' ? a : b;
}

export type JoinHostname<A extends string, B extends string> = B extends `` ? A : B;

export function joinHostname(a: string, b: string): string {
  return b === '' ? a : b;
}

// prettier-ignore
export type JoinPathname<A extends string, B extends string> =
  B extends '/' ? A :
	A extends `${infer L}/` ? `${L}${B}` :
	`${A}${B}`

export function joinPathname(a: string, b: string): string {
  // prettier-ignore
  return (
		b === '/' ? a :
		a.endsWith('/') ? a.slice(0, -1) + b :
		a + b
	);
}

// prettier-ignore
export type JoinSearch<A extends string, B extends string> =
	SearchString<[...SearchPairs<A>, ...SearchPairs<B>]>

export function joinSearch(a: string, b: string): string {
  return searchString([...searchPairs(a), ...searchPairs(b)]);
}
//#endregion

//#region SEARCH helpers
type SearchPair = [string, string];
type SearchPairString<T extends SearchPair> = T[1] extends '' ? T[0] : `${T[0]}=${T[1]}`;

type SearchString<T extends SearchPair[]> = SearchString_<SearchPairsString<T>>;
type SearchString_<T extends string> = T extends '' ? '' : `?${T}`;

// prettier-ignore
type SearchPairsString<T extends SearchPair[]> =
	T extends [infer L extends SearchPair, ...infer R extends SearchPair[]] ?
	  R extends [] ?
		  SearchPairString<L> :
			`${SearchPairString<L>}&${SearchPairsString<R>}` :
		''

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

function searchPairs(search: string): SearchPair[] {
  // prettier-ignore
  return (
		search === '' ? [] :
		search.startsWith('?') ? searchPairs(search.slice(1)) :
		search
		  .split('&')
		  .map(pair => pair.split('='))
			.map(([key, value]) => value === undefined ? [key, ''] : [key, value])
	);
}
//#endregion
