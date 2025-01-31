import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Params } from './params.ts';
import { RoutePattern } from './route-pattern.ts';

describe('RoutePattern', () => {
  it('ignores case by default', () => {
    assert.equal(new RoutePattern().ignoreCase, true);
  });

  it('ignores case when specified', () => {
    assert.equal(new RoutePattern('', { ignoreCase: true }).ignoreCase, true);
  });

  it('respects case when specified', () => {
    assert.equal(new RoutePattern('', { ignoreCase: false }).ignoreCase, false);
  });

  it('matches wildcards in hostnames', () => {
    assert.deepEqual(
      new RoutePattern('://*.remix.run').match(new URL('https://mj.remix.run'))!.params,
      new Params({ '*': 'mj' }),
    );
  });

  it('matches double slashes in pathnames', () => {
    assert.ok(new RoutePattern('//').match(new URL('https://remix.run//')));
  });

  it('matches params in hostnames', () => {
    assert.deepEqual(
      new RoutePattern('://:sub.remix.run').match(new URL('https://mj.remix.run'))!.params,
      new Params({ sub: 'mj' }),
    );
  });

  it('matches wildcards in pathnames', () => {
    assert.deepEqual(
      new RoutePattern('*').match(new URL('https://remix.run'))!.params,
      new Params({ '*': '' }),
    );
    assert.deepEqual(
      new RoutePattern('/*').match(new URL('https://remix.run/'))!.params,
      new Params({ '*': '' }),
    );

    assert.deepEqual(
      new RoutePattern('/*').match(new URL('https://remix.run/a'))!.params,
      new Params({ '*': 'a' }),
    );
    assert.deepEqual(
      new RoutePattern('/*').match(new URL('https://remix.run/a/b'))!.params,
      new Params({ '*': 'a/b' }),
    );

    assert.deepEqual(
      new RoutePattern('/a/*').match(new URL('https://remix.run/a/b'))!.params,
      new Params({ '*': 'b' }),
    );

    assert.deepEqual(
      new RoutePattern('/a/*/c').match(new URL('https://remix.run/a/b/c'))!.params,
      new Params({ '*': 'b' }),
    );
  });

  it('remembers multiple wildcards in the same pattern', () => {
    assert.deepEqual(
      new RoutePattern('://*.remix.run/a/*').match(new URL('https://mj.remix.run/a/b'))!.params,
      new Params({ '*': ['mj', 'b'] }),
    );
    assert.deepEqual(
      new RoutePattern('/a/*/c/*').match(new URL('https://remix.run/a/b/c/d'))!.params,
      new Params({ '*': ['b', 'd'] }),
    );
  });

  it('matches params in pathnames', () => {
    assert.deepEqual(
      new RoutePattern(':slug').match(new URL('https://remix.run/a'))!.params,
      new Params({ slug: 'a' }),
    );
    assert.deepEqual(
      new RoutePattern('/:slug').match(new URL('https://remix.run/a'))!.params,
      new Params({ slug: 'a' }),
    );
    assert.deepEqual(
      new RoutePattern('/:slug/').match(new URL('https://remix.run/a/'))!.params,
      new Params({ slug: 'a' }),
    );
    assert.deepEqual(
      new RoutePattern('/:slug/:id').match(new URL('https://remix.run/a/b'))!.params,
      new Params({ slug: 'a', id: 'b' }),
    );
    assert.deepEqual(
      new RoutePattern('/:slug/:id/').match(new URL('https://remix.run/a/b/'))!.params,
      new Params({ slug: 'a', id: 'b' }),
    );
  });

  it('escapes special regexp characters in source pathnames', () => {
    assert.ok(new RoutePattern('/a+b.c').match(new URL('https://remix.run/a+b.c')));
  });

  it('matches search', () => {
    assert.equal(new RoutePattern('?a=b').match(new URL('https://remix.run')), null);
    assert.ok(new RoutePattern('?a=b').match(new URL('https://remix.run/?a=b')));
    assert.equal(new RoutePattern('?a=b').match(new URL('https://remix.run/?a=c')), null);
    assert.ok(new RoutePattern('?a=b&c=d').match(new URL('https://remix.run/?a=b&c=d')));
    // additional search params are ok (they are ignored in the match)
    assert.ok(new RoutePattern('?a=b').match(new URL('https://remix.run/?a=b&c=d')));
  });

  it('matches repeat search params', () => {
    assert.ok(new RoutePattern('?sort').match(new URL('https://remix.run/?sort=price&sort=brand')));
    // out of order params are ok, returns the URL order, not the RoutePattern order
    assert.deepEqual(
      new RoutePattern('?sort=price&sort=brand')
        .match(new URL('https://remix.run/?sort=brand&sort=price'))!
        .searchParams.getAll('sort'),
      ['brand', 'price'],
    );
  });

  it('matches empty search values', () => {
    // empty search value, and empty in the URL
    assert.ok(new RoutePattern('?q').match(new URL('https://remix.run/?q')));
    // empty search value, but present in the URL
    assert.ok(new RoutePattern('?q').match(new URL('https://remix.run/?q=remix')));
    // multiple empty search values
    assert.ok(new RoutePattern('?q&a').match(new URL('https://remix.run/?q=remix&a=1')));
    // multiple empty search values, out of order
    assert.ok(new RoutePattern('?a&q').match(new URL('https://remix.run/?q=remix&a=1')));
    // empty search value, and additional search params in the URL
    assert.ok(
      new RoutePattern('?q').match(new URL('https://remix.run/?q=remix&utm_campaign=blah')),
    );
  });

  it('matches optional hostname segments', () => {
    assert.ok(new RoutePattern('://mj?.remix.run').match(new URL('https://remix.run')));
    assert.ok(new RoutePattern('://mj?.remix.run').match(new URL('https://mj.remix.run')));
    assert.ok(new RoutePattern('://:sub?.remix.run').match(new URL('https://remix.run')));
    assert.ok(new RoutePattern('://:sub?.remix.run').match(new URL('https://mj.remix.run')));
    assert.equal(
      new RoutePattern('://mj?.remix.run').match(new URL('https://mjmj.remix.run')),
      null,
    );
  });

  it('matches optional pathname segments', () => {
    assert.ok(new RoutePattern('/a?').match(new URL('https://remix.run')));
    assert.ok(new RoutePattern('/a?').match(new URL('https://remix.run/a')));
    assert.ok(new RoutePattern('/a?/b').match(new URL('https://remix.run/a/b')));
    assert.ok(new RoutePattern('/a?/b').match(new URL('https://remix.run/b')));
    assert.ok(new RoutePattern('/a?/b?').match(new URL('https://remix.run')));
    assert.ok(new RoutePattern('/a?/b?').match(new URL('https://remix.run/a')));
    assert.ok(new RoutePattern('/a?/b?').match(new URL('https://remix.run/b')));
    assert.ok(new RoutePattern('/a?/b?').match(new URL('https://remix.run/a/b')));
    assert.ok(new RoutePattern('/:id?').match(new URL('https://remix.run')));
    assert.ok(new RoutePattern('/:id?').match(new URL('https://remix.run/mj')));
    assert.ok(new RoutePattern('/:id?/b').match(new URL('https://remix.run/b')));
    assert.ok(new RoutePattern('/:id?/b').match(new URL('https://remix.run/mj/b')));
  });
});
