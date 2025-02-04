import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Refute, Equal, Extends } from '../../test/utils.ts';

import { Params } from './params.ts';

type ParamsVarianceSpec = [
  // specific params are assignable to generic params
  Assert<Extends<Params<'a'>, Params>>,
  // more specific params are assignable to less specific params
  Assert<Extends<Params<'a' | 'b'>, Params<'a'>>>,
  // empty params are assignable to generic params
  Assert<Extends<Params<never>, Params>>,
  // less specific params are NOT assignable to more specific params
  Refute<Extends<Params<'a'>, Params<'a' | 'b'>>>,
  // params with different param names do NOT extend one another
  Refute<Extends<Params<'b'>, Params<'a'>>>,
  // empty params are NOT assignable to specific params
  Refute<Extends<Params<never>, Params<'a'>>>,
];

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
    let params1 = new Params();
    let test1 = params1.has('unknown');
    type T1 = Assert<Equal<typeof test1, boolean>>;

    let params2 = new Params({ id: 'remix' });
    let test2 = params2.has('unknown');
    type T2 = Assert<Equal<typeof test2, boolean>>;
  });

  it('get() returns a string for known params', () => {
    let params = new Params({ id: 'remix' });
    let test = params.get('id');
    type T = Assert<Equal<typeof test, string>>;
  });

  it('get() returns string | null for unknown params', () => {
    let params1 = new Params();
    let test1 = params1.get('unknown');
    type T1 = Assert<Equal<typeof test1, string | null>>;

    let params2 = new Params({ id: 'remix' });
    let test2 = params2.get('unknown');
    type T2 = Assert<Equal<typeof test2, string | null>>;
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
