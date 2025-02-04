import type { String } from 'ts-toolbelt';

import type { Params } from './params.ts';
import type { ExtractHostname, ExtractPathname, ExtractSearch } from './route-pattern-helpers.ts';
import type { SearchParams } from './search-params.ts';

/**
 * The `Params` in a route pattern.
 */
export type RoutePatternParams<T extends string> = Params<
  HostnameParamName<ExtractHostname<T>> | PathnameParamName<ExtractPathname<T>>
>;

type HostnameParamName<T extends string> = ParamName<String.Split<T, '.'>[number]>;
type PathnameParamName<T extends string> = ParamName<String.Split<T, '/'>[number]>;
type ParamName<T> = T extends `:${infer R}` ? (R extends `${string}?` ? never : R) : never;

/**
 * The `SearchParams` in a route pattern.
 */
export type RoutePatternSearchParams<T extends string> = SearchParams<
  SearchParamName<ExtractSearch<T>>
>;

// prettier-ignore
type SearchParamName<T extends string> =
  T extends '' ? never :
  T extends `?${infer R}` ? SearchParamName_<R> :
  SearchParamName_<T>

type SearchParamName_<T extends string> = SearchPairName<String.Split<T, '&'>[number]>;

// prettier-ignore
type SearchPairName<T extends string> =
  T extends '' ? never :
  T extends `${infer L}=${string}` ?
    L extends '' ? never : L :
	T
