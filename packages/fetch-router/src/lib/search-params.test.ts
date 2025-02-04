import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal, Refute, Extends } from '../../test/utils.ts';

import { SearchParams } from './search-params.ts';

type SearchParamsVarianceSpec = [
  // specific search params are assignable to generic search params
  Assert<Extends<SearchParams<'a'>, SearchParams>>,
  // more specific search params are assignable to less specific search params
  Assert<Extends<SearchParams<'a' | 'b'>, SearchParams<'a'>>>,
  // empty search params are assignable to generic search params
  Assert<Extends<SearchParams<never>, SearchParams>>,
  // less specific search params are NOT assignable to more specific search params
  Refute<Extends<SearchParams<'a'>, SearchParams<'a' | 'b'>>>,
  // search params with different search param names do NOT extend one another
  Refute<Extends<SearchParams<'b'>, SearchParams<'a'>>>,
  // empty search params are NOT assignable to specific search params
  Refute<Extends<SearchParams<never>, SearchParams<'a'>>>,
];

describe('SearchParams', () => {
  it('has() returns true for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.has('id');
    type T = Assert<Equal<typeof test, true>>;
  });

  it('has() returns a boolean for unknown params', () => {
    let params1 = new SearchParams();
    let test1 = params1.has('unknown');
    type T1 = Assert<Equal<typeof test1, boolean>>;

    let params2 = new SearchParams({ id: 'remix' });
    let test2 = params2.has('unknown');
    type T2 = Assert<Equal<typeof test2, boolean>>;
  });

  it('get() returns a string for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string>>;
  });

  it('get() returns string | null for unknown params', () => {
    let params1 = new SearchParams();
    let test1 = params1.get('unknown');
    type T1 = Assert<Equal<typeof test1, string | null>>;

    let params2 = new SearchParams({ id: 'remix' });
    let test2 = params2.get('unknown');
    type T2 = Assert<Equal<typeof test2, string | null>>;
  });

  it('gets the first value for a param with multiple values', () => {
    let params = new SearchParams([
      ['id', 'remix'],
      ['id', 'run'],
    ]);
    assert.equal(params.get('id'), 'remix');
  });

  it('knows how to convert to a search string', () => {
    let params = new SearchParams({ a: '1', b: '2' });
    assert.equal(params.toString(), '?a=1&b=2');
  });
});
