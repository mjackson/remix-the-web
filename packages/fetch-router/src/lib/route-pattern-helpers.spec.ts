/* eslint-disable @typescript-eslint/no-unused-vars */
import { Assert, Equal } from '../../test/spec-helpers.js';
import {
  HostnameParamName,
  PathnameParamName,
  OptionalHostnameParamName,
  OptionalPathnameParamName,
  SearchParamName,
} from './route-pattern-helpers.js';

type HostnameParamNameSpec = [
  Assert<Equal<HostnameParamName<''>, never>>,
  Assert<Equal<HostnameParamName<'remix.run'>, never>>,
  Assert<Equal<HostnameParamName<'mj.remix.run'>, never>>,
  Assert<Equal<HostnameParamName<':sub.remix.run'>, 'sub'>>,
  Assert<Equal<HostnameParamName<':sub?.remix.run'>, never>>,
  Assert<Equal<HostnameParamName<':sub?.:id.remix.run'>, 'id'>>,
  Assert<Equal<HostnameParamName<':sub?.:id?.remix.run'>, never>>,
];

type PathnameParamNameSpec = [
  Assert<Equal<PathnameParamName<''>, never>>,
  Assert<Equal<PathnameParamName<'/'>, never>>,
  Assert<Equal<PathnameParamName<'//'>, never>>,
  Assert<Equal<PathnameParamName<'/blog'>, never>>,
  Assert<Equal<PathnameParamName<'/blog/:slug'>, 'slug'>>,
  Assert<Equal<PathnameParamName<'/blog/:slug?'>, never>>,
  Assert<Equal<PathnameParamName<'/blog/:slug?/:id'>, 'id'>>,
  Assert<Equal<PathnameParamName<'/blog/:slug?/:id?'>, never>>,
];

type OptionalHostnameParamNameSpec = [
  Assert<Equal<OptionalHostnameParamName<''>, never>>,
  Assert<Equal<OptionalHostnameParamName<'remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<'mj.remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<':sub.remix.run'>, never>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.remix.run'>, 'sub'>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.:id.remix.run'>, 'sub'>>,
  Assert<Equal<OptionalHostnameParamName<':sub?.:id?.remix.run'>, 'sub' | 'id'>>,
  Assert<Equal<OptionalHostnameParamName<'*.remix.run'>, '*'>>,
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
  Assert<Equal<OptionalPathnameParamName<'/files/*'>, '*'>>,
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
