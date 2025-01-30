/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.ts';
import { SearchParams } from './search-params.ts';

describe('SearchParams', () => {
  it('has() returns true for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.has('id');
    type T = Assert<Equal<typeof test, true>>;
  });

  it('has() returns a boolean for unknown params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.has('name');
    type T = Assert<Equal<typeof test, boolean>>;
  });

  it('get() returns a string for known params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string>>;
  });

  it('get() returns string | null for unknown params', () => {
    let params = new SearchParams({ id: 'remix' });
    let test = params.get('name');
    type T = Assert<Equal<typeof test, string | null>>;
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
