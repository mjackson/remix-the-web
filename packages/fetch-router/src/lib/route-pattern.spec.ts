/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import { Params } from './params.js';
import {
  RoutePattern,
  ExtractProtocol,
  extractProtocol,
  ExtractHostname,
  extractHostname,
  ExtractPathname,
  extractPathname,
  ExtractSearch,
  extractSearch,
  JoinPatterns,
  joinPatterns,
  JoinPattern,
  joinPattern,
  JoinProtocol,
  joinProtocol,
  JoinHostname,
  joinHostname,
  JoinPathname,
  joinPathname,
  JoinSearch,
  joinSearch,
} from './route-pattern.js';

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

//#region EXTRACT specs
type ExtractProtocolSpec = [
  Assert<Equal<ExtractProtocol<''>, ''>>,
  Assert<Equal<ExtractProtocol<'http://'>, 'http:'>>,
  Assert<Equal<ExtractProtocol<'https://'>, 'https:'>>,
  Assert<Equal<ExtractProtocol<'https?://'>, 'https?:'>>,
  Assert<Equal<ExtractProtocol<'https?://remix.run'>, 'https?:'>>,
  Assert<Equal<ExtractProtocol<'https?://remix.run/blog'>, 'https?:'>>,
];

describe('extractProtocol', () => {
  it('returns the protocol from a pattern', () => {
    assert.equal(extractProtocol(''), '');
    assert.equal(extractProtocol('http://'), 'http:');
    assert.equal(extractProtocol('https://'), 'https:');
    assert.equal(extractProtocol('https?://'), 'https?:');
    assert.equal(extractProtocol('https?://remix.run'), 'https?:');
    assert.equal(extractProtocol('https?://remix.run/blog'), 'https?:');
  });
});

type ExtractHostnameSpec = [
  Assert<Equal<ExtractHostname<''>, ''>>,
  Assert<Equal<ExtractHostname<'http://'>, ''>>,
  Assert<Equal<ExtractHostname<'://localhost'>, 'localhost'>>,
  Assert<Equal<ExtractHostname<'http://localhost'>, 'localhost'>>,
  Assert<Equal<ExtractHostname<'http://remix.run'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run/'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run/blog'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https?://remix.run'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https?://remix.run/'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https?://remix.run/blog'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://www.remix.run'>, 'www.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://www?.remix.run'>, 'www?.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://:sub.remix.run'>, ':sub.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://:sub?.remix.run'>, ':sub?.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://*.remix.run'>, '*.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run?'>, 'remix.run?'>>,
  Assert<Equal<ExtractHostname<'https://remix.run?q'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run??q'>, 'remix.run?'>>,
];

describe('extractHostname', () => {
  it('returns the hostname from a pattern', () => {
    assert.equal(extractHostname(''), '');
    assert.equal(extractHostname('http://'), '');
    assert.equal(extractHostname('://localhost'), 'localhost');
    assert.equal(extractHostname('http://localhost'), 'localhost');
    assert.equal(extractHostname('http://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://remix.run/'), 'remix.run');
    assert.equal(extractHostname('https://remix.run/blog'), 'remix.run');
    assert.equal(extractHostname('https?://remix.run'), 'remix.run');
    assert.equal(extractHostname('https?://remix.run/'), 'remix.run');
    assert.equal(extractHostname('https?://remix.run/blog'), 'remix.run');
    assert.equal(extractHostname('https://www.remix.run'), 'www.remix.run');
    assert.equal(extractHostname('https://www?.remix.run'), 'www?.remix.run');
    assert.equal(extractHostname('https://:sub.remix.run'), ':sub.remix.run');
    assert.equal(extractHostname('https://:sub?.remix.run'), ':sub?.remix.run');
    assert.equal(extractHostname('https://*.remix.run'), '*.remix.run');
    assert.equal(extractHostname('https://remix.run?'), 'remix.run?');
    assert.equal(extractHostname('https://remix.run?q'), 'remix.run');
    assert.equal(extractHostname('https://remix.run??q'), 'remix.run?');
  });
});

type ExtractPathnameSpec = [
  Assert<Equal<ExtractPathname<''>, '/'>>,
  Assert<Equal<ExtractPathname<'/'>, '/'>>,
  Assert<Equal<ExtractPathname<'/?'>, '/'>>,
  Assert<Equal<ExtractPathname<'/??'>, '/'>>,
  Assert<Equal<ExtractPathname<'//'>, '//'>>,
  Assert<Equal<ExtractPathname<'a'>, '/a'>>,
  Assert<Equal<ExtractPathname<'/a'>, '/a'>>,
  Assert<Equal<ExtractPathname<'a/b'>, '/a/b'>>,
  Assert<Equal<ExtractPathname<'/a/b'>, '/a/b'>>,
  Assert<Equal<ExtractPathname<'/a/:b'>, '/a/:b'>>,
  Assert<Equal<ExtractPathname<'/a/b?'>, '/a/b?'>>,
  Assert<Equal<ExtractPathname<'/a/:b?'>, '/a/:b?'>>,
  Assert<Equal<ExtractPathname<'/:a/b'>, '/:a/b'>>,
  Assert<Equal<ExtractPathname<'/:a/:b'>, '/:a/:b'>>,
  Assert<Equal<ExtractPathname<'/:a/b?'>, '/:a/b?'>>,
  Assert<Equal<ExtractPathname<'/:a/:b?'>, '/:a/:b?'>>,
  Assert<Equal<ExtractPathname<'/a?/b'>, '/a?/b'>>,
  Assert<Equal<ExtractPathname<'/a?/:b'>, '/a?/:b'>>,
  Assert<Equal<ExtractPathname<'/a?/b?'>, '/a?/b?'>>,
  Assert<Equal<ExtractPathname<'/a?/:b?'>, '/a?/:b?'>>,
  Assert<Equal<ExtractPathname<'/a/b/c??'>, '/a/b/c?'>>,
  Assert<Equal<ExtractPathname<'/a/b/c/?'>, '/a/b/c/'>>,
  Assert<Equal<ExtractPathname<'/a/b/c?'>, '/a/b/c?'>>,
  Assert<Equal<ExtractPathname<'/a/b?/c'>, '/a/b?/c'>>,
  Assert<Equal<ExtractPathname<'/a/b/c??q'>, '/a/b/c?'>>,
  Assert<Equal<ExtractPathname<'/a/b/c?q'>, '/a/b/c'>>,
  Assert<Equal<ExtractPathname<'https://remix.run'>, '/'>>,
  Assert<Equal<ExtractPathname<'https://remix.run/a'>, '/a'>>,
];

describe('extractPathname', () => {
  it('returns the pathname from a combined pathname + search pattern', () => {
    assert.equal(extractPathname(''), '/');
    assert.equal(extractPathname('/'), '/');
    assert.equal(extractPathname('/?'), '/');
    assert.equal(extractPathname('/??'), '/');
    assert.equal(extractPathname('//'), '//');
    assert.equal(extractPathname('a'), '/a');
    assert.equal(extractPathname('/a'), '/a');
    assert.equal(extractPathname('a/b'), '/a/b');
    assert.equal(extractPathname('/a/b'), '/a/b');
    assert.equal(extractPathname('/a/:b'), '/a/:b');
    assert.equal(extractPathname('/a/b?'), '/a/b?');
    assert.equal(extractPathname('/a/:b?'), '/a/:b?');
    assert.equal(extractPathname('/:a/b'), '/:a/b');
    assert.equal(extractPathname('/:a/:b'), '/:a/:b');
    assert.equal(extractPathname('/:a/b?'), '/:a/b?');
    assert.equal(extractPathname('/:a/:b?'), '/:a/:b?');
    assert.equal(extractPathname('/a?/b'), '/a?/b');
    assert.equal(extractPathname('/a?/:b'), '/a?/:b');
    assert.equal(extractPathname('/a?/b?'), '/a?/b?');
    assert.equal(extractPathname('/a?/:b?'), '/a?/:b?');
    assert.equal(extractPathname('/a/b/c??'), '/a/b/c?');
    assert.equal(extractPathname('/a/b/c/?'), '/a/b/c/');
    assert.equal(extractPathname('/a/b/c?'), '/a/b/c?');
    assert.equal(extractPathname('/a/b?/c'), '/a/b?/c');
    assert.equal(extractPathname('/a/b/c??q'), '/a/b/c?');
    assert.equal(extractPathname('/a/b/c?q'), '/a/b/c');
    assert.equal(extractPathname('https://remix.run'), '/');
    assert.equal(extractPathname('https://remix.run/a'), '/a');
  });
});

type ExtractSearchSpec = [
  Assert<Equal<ExtractSearch<''>, ''>>,
  Assert<Equal<ExtractSearch<'/'>, ''>>,
  Assert<Equal<ExtractSearch<'/?'>, '?'>>,
  Assert<Equal<ExtractSearch<'/??'>, '??'>>,
  Assert<Equal<ExtractSearch<'/'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/:b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/:b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/:a/b'>, ''>>,
  Assert<Equal<ExtractSearch<'/:a/:b'>, ''>>,
  Assert<Equal<ExtractSearch<'/:a/b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/:a/:b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a?/b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a?/:b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a?/b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a?/:b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b/c??'>, '?'>>,
  Assert<Equal<ExtractSearch<'/a/b/c/?'>, '?'>>,
  Assert<Equal<ExtractSearch<'/a/b/c?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b?/c'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b/c??q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'/a/b/c?q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'/a/b/c?q=1'>, '?q=1'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/?q=1'>, '?q=1'>>,
];

describe('extractSearch', () => {
  it('returns the search from a combined pathname + search pattern', () => {
    assert.equal(extractSearch(''), '');
    assert.equal(extractSearch('/'), '');
    assert.equal(extractSearch('/?'), '?');
    assert.equal(extractSearch('/??'), '??');
    assert.equal(extractSearch('/'), '');
    assert.equal(extractSearch('/a/b'), '');
    assert.equal(extractSearch('/a/:b'), '');
    assert.equal(extractSearch('/a/b?'), '');
    assert.equal(extractSearch('/a/:b?'), '');
    assert.equal(extractSearch('/:a/b'), '');
    assert.equal(extractSearch('/:a/:b'), '');
    assert.equal(extractSearch('/:a/b?'), '');
    assert.equal(extractSearch('/:a/:b?'), '');
    assert.equal(extractSearch('/a?/b'), '');
    assert.equal(extractSearch('/a?/:b'), '');
    assert.equal(extractSearch('/a?/b?'), '');
    assert.equal(extractSearch('/a?/:b?'), '');
    assert.equal(extractSearch('/a/b/c??'), '?');
    assert.equal(extractSearch('/a/b/c/?'), '?');
    assert.equal(extractSearch('/a/b/c?'), '');
    assert.equal(extractSearch('/a/b?/c'), '');
    assert.equal(extractSearch('/a/b/c??q'), '?q');
    assert.equal(extractSearch('/a/b/c?q'), '?q');
    assert.equal(extractSearch('/a/b/c?q=1'), '?q=1');
    assert.equal(extractSearch('https://remix.run/?q=1'), '?q=1');
  });
});
//#endregion

//#region JOIN specs
type JoinPatternsSpec = [
  Assert<Equal<JoinPatterns<'', ''>, '/'>>,
  Assert<Equal<JoinPatterns<'/', ''>, '/'>>,
  Assert<Equal<JoinPatterns<'', '/'>, '/'>>,
  Assert<Equal<JoinPatterns<'/', '/'>, '/'>>,
  Assert<Equal<JoinPatterns<'a', 'b'>, '/a/b'>>,
  Assert<Equal<JoinPatterns<'/a', '/b'>, '/a/b'>>,
  Assert<Equal<JoinPatterns<'/a?', '/b'>, '/a?/b'>>,
  Assert<Equal<JoinPatterns<'/a', '/b?'>, '/a/b?'>>,
  Assert<Equal<JoinPatterns<'/a?', '?q'>, '/a??q'>>,
  Assert<Equal<JoinPatterns<'/a?', '/?q'>, '/a??q'>>,
  Assert<Equal<JoinPatterns<'?q', '?s'>, '/?q&s'>>,
  Assert<Equal<JoinPatterns<'https://remix.run', '/b'>, 'https://remix.run/b'>>,
  Assert<Equal<JoinPatterns<'https://remix.run/', '/b'>, 'https://remix.run/b'>>,
  Assert<Equal<JoinPatterns<'https://remix.run/a', '/b'>, 'https://remix.run/a/b'>>,
];

describe('joinPatterns', () => {
  assert.equal(joinPatterns('', ''), '/');
  assert.equal(joinPatterns('/', ''), '/');
  assert.equal(joinPatterns('', '/'), '/');
  assert.equal(joinPatterns('/', '/'), '/');
  assert.equal(joinPatterns('a', 'b'), '/a/b');
  assert.equal(joinPatterns('/a', '/b'), '/a/b');
  assert.equal(joinPatterns('/a?', '/b'), '/a?/b');
  assert.equal(joinPatterns('/a', '/b?'), '/a/b?');
  assert.equal(joinPatterns('/a?', '?q'), '/a??q');
  assert.equal(joinPatterns('/a?', '/?q'), '/a??q');
  assert.equal(joinPatterns('?q', '?s'), '/?q&s');
  assert.equal(joinPatterns('https://remix.run', '/b'), 'https://remix.run/b');
  assert.equal(joinPatterns('https://remix.run/', '/b'), 'https://remix.run/b');
  assert.equal(joinPatterns('https://remix.run/a', '/b'), 'https://remix.run/a/b');
});

type JoinPatternSpec = [
  Assert<Equal<JoinPattern<'', '', '', ''>, ''>>,
  Assert<Equal<JoinPattern<'http:', '', '', ''>, ''>>,
  Assert<Equal<JoinPattern<'', 'remix.run', '', ''>, '://remix.run'>>,
  Assert<Equal<JoinPattern<'', '', '/', ''>, '/'>>,
  Assert<Equal<JoinPattern<'', '', '', '?q'>, '?q'>>,
  Assert<Equal<JoinPattern<'http:', 'remix.run', '/', '?q'>, 'http://remix.run/?q'>>,
];

describe('joinPattern', () => {
  assert.equal(joinPattern('', '', '', ''), '');
  assert.equal(joinPattern('http:', '', '', ''), '');
  assert.equal(joinPattern('', 'remix.run', '', ''), '://remix.run');
  assert.equal(joinPattern('', '', '/', ''), '/');
  assert.equal(joinPattern('', '', '', '?q'), '?q');
  assert.equal(joinPattern('http:', 'remix.run', '/', '?q'), 'http://remix.run/?q');
});

type JoinProtocolSpec = [
  Assert<Equal<JoinProtocol<'', ''>, ''>>,
  Assert<Equal<JoinProtocol<'', 'http:'>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', ''>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', 'http:'>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', 'https:'>, 'https:'>>,
];

describe('joinProtocol', () => {
  it('joins two protocols', () => {
    assert.equal(joinProtocol('', ''), '');
    assert.equal(joinProtocol('', 'http:'), 'http:');
    assert.equal(joinProtocol('http:', ''), 'http:');
    assert.equal(joinProtocol('http:', 'http:'), 'http:');
    assert.equal(joinProtocol('http:', 'https:'), 'https:');
  });
});

type JoinHostnameSpec = [
  Assert<Equal<JoinHostname<'', ''>, ''>>,
  Assert<Equal<JoinHostname<'localhost', ''>, 'localhost'>>,
  Assert<Equal<JoinHostname<'remix.run', ''>, 'remix.run'>>,
  Assert<Equal<JoinHostname<'remix.run', 'shopify.com'>, 'shopify.com'>>,
];

describe('joinHostname', () => {
  it('joins two hostnames', () => {
    assert.equal(joinHostname('', ''), '');
    assert.equal(joinHostname('localhost', ''), 'localhost');
    assert.equal(joinHostname('remix.run', ''), 'remix.run');
    assert.equal(joinHostname('remix.run', 'shopify.com'), 'shopify.com');
  });
});

type JoinPathnameSpec = [
  Assert<Equal<JoinPathname<'/', '/'>, '/'>>,
  Assert<Equal<JoinPathname<'/', '//'>, '//'>>,
  Assert<Equal<JoinPathname<'//', '/'>, '//'>>,
  Assert<Equal<JoinPathname<'/', '/a'>, '/a'>>,
  Assert<Equal<JoinPathname<'/', '/a/b'>, '/a/b'>>,
  Assert<Equal<JoinPathname<'/a', '/'>, '/a'>>,
  Assert<Equal<JoinPathname<'/a/', '/'>, '/a/'>>,
  Assert<Equal<JoinPathname<'/a/b', '/'>, '/a/b'>>,
];

describe('joinPathname', () => {
  it('joins two pathnames', () => {
    assert.equal(joinPathname('/', '/'), '/');
    assert.equal(joinPathname('/', '//'), '//');
    assert.equal(joinPathname('//', '/'), '//');
    assert.equal(joinPathname('/', '/a'), '/a');
    assert.equal(joinPathname('/', '/a/b'), '/a/b');
    assert.equal(joinPathname('/a', '/'), '/a');
    assert.equal(joinPathname('/a/', '/'), '/a/');
    assert.equal(joinPathname('/a/b', '/'), '/a/b');
  });
});

type JoinSearchSpec = [
  Assert<Equal<JoinSearch<'', ''>, ''>>,
  Assert<Equal<JoinSearch<'', '?q'>, '?q'>>,
  Assert<Equal<JoinSearch<'?q', ''>, '?q'>>,
  Assert<Equal<JoinSearch<'?q', '?q'>, '?q&q'>>,
  Assert<Equal<JoinSearch<'?brand', '?brand=adidas'>, '?brand&brand=adidas'>>,
  Assert<Equal<JoinSearch<'?brand=nike', '?brand=adidas'>, '?brand=nike&brand=adidas'>>,
  Assert<
    Equal<JoinSearch<'?brand=nike&sort=asc', '?brand=adidas'>, '?brand=nike&sort=asc&brand=adidas'>
  >,
];

describe('joinSearch', () => {
  it('joins two search strings', () => {
    assert.equal(joinSearch('', ''), '');
    assert.equal(joinSearch('', '?q'), '?q');
    assert.equal(joinSearch('?q', ''), '?q');
    assert.equal(joinSearch('?q', '?q'), '?q&q');
    assert.equal(joinSearch('?brand', '?brand=adidas'), '?brand&brand=adidas');
    assert.equal(joinSearch('?brand=nike', '?brand=adidas'), '?brand=nike&brand=adidas');
    assert.equal(
      joinSearch('?brand=nike&sort=asc', '?brand=adidas'),
      '?brand=nike&sort=asc&brand=adidas',
    );
  });
});
//#endregion
