/* eslint-disable @typescript-eslint/no-unused-vars */
import { Assert, Equal } from '../../test/spec-helpers.js';
import {
  RequiredHostnameParamName,
  OptionalHostnameParamName,
  RequiredPathnameParamName,
  OptionalPathnameParamName,
  SearchParamName,
} from './params-helpers.js';

type RequiredHostnameParamNameSpec = [
  Assert<Equal<RequiredHostnameParamName<''>, never>>,
  Assert<Equal<RequiredHostnameParamName<'remix.run'>, never>>,
  Assert<Equal<RequiredHostnameParamName<'mj.remix.run'>, never>>,
  Assert<Equal<RequiredHostnameParamName<':sub.remix.run'>, 'sub'>>,
  Assert<Equal<RequiredHostnameParamName<':sub?.remix.run'>, never>>,
  Assert<Equal<RequiredHostnameParamName<':sub?.:id.remix.run'>, 'id'>>,
  Assert<Equal<RequiredHostnameParamName<':sub?.:id?.remix.run'>, never>>,
];

type OptionalHostnameParamNameSpec = [
  Assert<Equal<OptionalHostnameParamName<''>, never>>,
  Assert<Equal<OptionalHostnameParamName<'remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<'mj.remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<':sub.remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.remix.run'>, 'sub'>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.:id.remix.run'>, 'sub'>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.:id?.remix.run'>, 'sub' | 'id'>>,
];

type RequiredPathnameParamNameSpec = [
  Assert<Equal<RequiredPathnameParamName<''>, never>>,
  Assert<Equal<RequiredPathnameParamName<'/'>, never>>,
  Assert<Equal<RequiredPathnameParamName<'//'>, never>>,
  Assert<Equal<RequiredPathnameParamName<'/blog'>, never>>,
  Assert<Equal<RequiredPathnameParamName<'/blog/:slug'>, 'slug'>>,
  Assert<Equal<RequiredPathnameParamName<'/blog/:slug?'>, never>>,
  Assert<Equal<RequiredPathnameParamName<'/blog/:slug?/:id'>, 'id'>>,
  Assert<Equal<RequiredPathnameParamName<'/blog/:slug?/:id?'>, never>>,
];

type OptionalPathnameParamNameSpec = [
  Assert<Equal<OptionalPathnameParamName<''>, never>>,
  Assert<Equal<OptionalPathnameParamName<'/'>, never>>,
  Assert<Equal<OptionalPathnameParamName<'//'>, never>>,
  Assert<Equal<OptionalPathnameParamName<'/blog'>, never>>,
  Assert<Equal<OptionalPathnameParamName<'/blog/:slug'>, never>>,
  Assert<Equal<OptionalPathnameParamName<'/blog/:slug?'>, 'slug'>>,
  Assert<Equal<OptionalPathnameParamName<'/blog/:slug?/:id'>, 'slug'>>,
  Assert<Equal<OptionalPathnameParamName<'/blog/:slug?/:id?'>, 'slug' | 'id'>>,
];

type SearchParamNameSpec = [
  Assert<Equal<SearchParamName<''>, never>>,
  Assert<Equal<SearchParamName<'?'>, never>>,
  Assert<Equal<SearchParamName<'?='>, never>>,
  Assert<Equal<SearchParamName<'?a'>, 'a'>>,
  Assert<Equal<SearchParamName<'?a=1'>, 'a'>>,
  Assert<Equal<SearchParamName<'?a&b'>, 'a' | 'b'>>,
  Assert<Equal<SearchParamName<'?a=1&b'>, 'a' | 'b'>>,
  Assert<Equal<SearchParamName<'?a=1&b='>, 'a' | 'b'>>,
  Assert<Equal<SearchParamName<'?a&b=2'>, 'a' | 'b'>>,
  Assert<Equal<SearchParamName<'?a=1&b=2'>, 'a' | 'b'>>,
  Assert<Equal<SearchParamName<'?a=1&b=2&c'>, 'a' | 'b' | 'c'>>,
];
