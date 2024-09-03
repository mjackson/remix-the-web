/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import { SearchParams } from './search-params.js';

describe('SearchParams', () => {
  it('infers the types of keys from a search string', () => {
    let params = SearchParams.fromSearch('id=remix&id=rocks');
    type T = Assert<Equal<typeof params, SearchParams<'id'>>>;
  });

  it('has() returns a boolean for unknown params', () => {
    let params = new SearchParams();
    let test = params.has('id');
    type T = Assert<Equal<typeof test, boolean>>;
  });

  it('has() returns true for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.has('id');
    type T = Assert<Equal<typeof test, true>>;
  });

  it('get() returns string | null for unknown params', () => {
    let params = new SearchParams();
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string | null>>;
  });

  it('get() returns a string for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string>>;
  });

  it('knows how to parse a query string', () => {
    let params = SearchParams.fromSearch('a=1&b=2');
    assert.equal(params.get('a'), '1');
    assert.equal(params.get('b'), '2');
  });

  it('knows how to parse a query string with no value', () => {
    let params = SearchParams.fromSearch('a&b');
    assert.equal(params.get('a'), '');
    assert.equal(params.get('b'), '');
  });

  it('knows how to convert to a search string', () => {
    let params = new SearchParams({ a: '1', b: '2' });
    assert.equal(params.toString(), '?a=1&b=2');
  });
});
