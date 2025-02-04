import type { Assert, Equal } from '../../test/utils.ts';

import type { Params } from './params.ts';
import type { RoutePatternParams, RoutePatternSearchParams } from './route-pattern-params.ts';
import type { SearchParams } from './search-params.ts';

// prettier-ignore
type RoutePatternParamsSpec = [
  Assert<Equal<RoutePatternParams<''>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'/'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'/blog'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'/blog/:slug'>, Params<'slug'>>>,
  Assert<Equal<RoutePatternParams<'/blog/:slug?'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'/blog/:slug?q'>, Params<'slug'>>>,
  Assert<Equal<RoutePatternParams<'https://remix.run'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'https://:sub.remix.run'>, Params<'sub'>>>,
  Assert<Equal<RoutePatternParams<'https://:sub?.remix.run'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'https://:sub?.:id.remix.run'>, Params<'id'>>>,
  Assert<Equal<RoutePatternParams<'https://:sub?.:id?.remix.run'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'https://*.remix.run'>, Params<never>>>,
  Assert<Equal<RoutePatternParams<'https://remix.run/blog/:slug'>, Params<'slug'>>>,
  Assert<Equal<RoutePatternParams<'https://:sub.remix.run/blog/:slug'>, Params<'sub' | 'slug'>>>,
  Assert<Equal<RoutePatternParams<'https://remix.run/blog/:slug?'>, Params<never>>>,
];

// prettier-ignore
type RoutePatternSearchParamsSpec = [
  Assert<Equal<RoutePatternSearchParams<''>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'?'>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'?='>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'?a'>, SearchParams<'a'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a=1'>, SearchParams<'a'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a&b'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a=1&b'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a=1&b='>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a&b=2'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'?a=1&b=2'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run'>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?'>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?='>, SearchParams<never>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a'>, SearchParams<'a'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a=1'>, SearchParams<'a'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a&b'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a=1&b'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a=1&b='>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a&b=2'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run?a=1&b=2'>, SearchParams<'a' | 'b'>>>,
  Assert<Equal<RoutePatternSearchParams<'https://remix.run/path?a'>, SearchParams<'a'>>>,
];
