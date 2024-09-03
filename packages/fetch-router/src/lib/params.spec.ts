/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import { Params } from './params.js';

describe('Params', () => {
  it('infers the types of required keys from an array in the constructor', () => {
    let params = new Params([
      ['a', 'remix'],
      ['b', 'rocks'],
    ]);
    type T = Assert<Equal<typeof params, Params<'a' | 'b'>>>;
  });

  it('infers the types of required keys from an iterable in the constructor', () => {
    let params = new Params(
      new Map([
        ['a', 'remix'],
        ['b', 'rocks'],
      ]),
    );
    type T = Assert<Equal<typeof params, Params<'a' | 'b'>>>;
  });

  it('infers the types of required keys from an object in the constructor', () => {
    let params = new Params({ a: 'remix', b: 'rocks' });
    type T = Assert<Equal<typeof params, Params<'a' | 'b'>>>;
  });

  it('accepts an array in the constructor', () => {
    let params = new Params([
      ['id', 'remix'],
      ['id', 'rocks'],
    ]);
    assert.deepEqual(params.getAll('id'), ['remix', 'rocks']);
  });

  it('accepts an iterable in the constructor', () => {
    let params = new Params(
      new Map([
        ['a', 'remix'],
        ['b', 'rocks'],
      ]),
    );
    assert.equal(params.get('a'), 'remix');
    assert.equal(params.get('b'), 'rocks');
  });

  it('accepts an object with string values in the constructor', () => {
    let params = new Params({ id: 'remix' });
    assert.equal(params.get('id'), 'remix');
  });

  it('accepts an object with array values in the constructor', () => {
    let params = new Params({ id: ['remix'] });
    assert.equal(params.get('id'), 'remix');
  });

  it('accepts another Params in the constructor', () => {
    let params = new Params(new Params({ id: 'remix' }));
    assert.equal(params.get('id'), 'remix');
  });

  it('has() returns true for known params', () => {
    let params = new Params({ id: 'remix' });
    let test = params.has('id');
    type T = Assert<Equal<typeof test, true>>;
  });

  it('has() returns a boolean for unknown params', () => {
    let params = new Params();
    let test = params.has('id');
    type T = Assert<Equal<typeof test, boolean>>;
  });

  it('get() returns a string for known params', () => {
    let params = new Params({ id: 'remix' });
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string>>;
  });

  it('get() returns string | null for unknown params', () => {
    let params = new Params();
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string | null>>;
  });

  it('returns the value of a param', () => {
    let params = new Params({ id: ['remix'] });
    assert.equal(params.get('id'), 'remix');
  });

  it('returns null if the param does not exist', () => {
    let params = new Params();
    assert.equal(params.get('id'), null);
  });

  it('returns all the values of a param', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    assert.deepEqual(params.getAll('id'), ['remix', 'rocks']);
  });

  it('returns an empty array if the param does not exist', () => {
    let params = new Params();
    assert.deepEqual(params.getAll('id'), []);
  });

  it('returns true if the param exists', () => {
    let params = new Params({ id: ['remix'] });
    assert.equal(params.has('id'), true);
  });

  it('returns false if the param does not exist', () => {
    let params = new Params();
    assert.equal(params.has('id'), false);
  });

  // this is so that a route can say `params.get("id")` and never have to think
  // about its order in the route hierarchy. The only code that will need to
  // think about order is the code that calls `getAll`, which is expected to be
  // rare, otherwise child routes will always need to be aware of position, and
  // if a parent changes their param name, the child route code will break,
  // which would be difficult to anticipate.
  it('returns the last param when using get()', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    assert.deepEqual(params.getAll('id'), ['remix', 'rocks']);
    assert.equal(params.get('id'), 'rocks');
  });

  it('returns the keys', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    assert.deepEqual(Array.from(params.keys()), ['id', 'id']);
  });

  it('returns the values', () => {
    let params = new Params({ id: ['remix'] });
    assert.deepEqual(Array.from(params.values()), ['remix']);
  });

  it('returns the entries', () => {
    let params = new Params({ id: ['remix'] });
    assert.deepEqual(Array.from(params.entries()), [['id', 'remix']]);
  });

  it('returns an empty iterator if there are no keys', () => {
    let params = new Params();
    assert.deepEqual(Array.from(params.keys()), []);
  });

  it('returns an empty iterator if there are no values', () => {
    let params = new Params();
    assert.deepEqual(Array.from(params.values()), []);
  });

  it('returns an empty iterator if there are no entries', () => {
    let params = new Params();
    assert.deepEqual(Array.from(params.entries()), []);
  });

  it('converts to JSON', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    assert.deepEqual(params.toJSON(), [
      ['id', 'remix'],
      ['id', 'rocks'],
    ]);
  });

  it('can be instantited with the JSON version of another Params', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    let params2 = new Params(params.toJSON());
    assert.deepEqual(params2, params);
  });

  it('converts to a string', () => {
    let params = new Params({ id: ['remix', 'rocks'] });
    assert.equal(params.toString(), '[Params id=remix, id=rocks]');
  });
});
