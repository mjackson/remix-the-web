import { String, Union } from 'ts-toolbelt';

import { Params } from './params.ts';
import { SearchParams } from './search-params.ts';

/**
 * A string literal type representing the hostname and pathname parameters of a route pattern.
 */
export type ParamsString<P extends Params> =
  P extends Params<infer R, infer O>
    ? `/${String.Join<Union.ListOf<(string extends R ? never : `:${R}`) | (string extends O ? never : `:${O}?`)>, '/'>}`
    : never;

/**
 * A string literal type representing the search/query parameters of a route pattern.
 */
// prettier-ignore
export type SearchParamsString<S extends SearchParams> =
  S extends SearchParams<infer T> ? SearchParamsString_<T> : never;

// prettier-ignore
type SearchParamsString_<T extends string> =
  string extends T ? '' : SearchString<String.Join<Union.ListOf<T>, '&'>>;

type SearchString<T extends string> = T extends '' ? '' : `?${T}`;
