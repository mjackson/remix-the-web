import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal } from '../../test/utils.ts';
import {
  extractProtocol,
  extractHostname,
  extractPathname,
  extractSearch,
  joinProtocol,
  joinHostname,
  joinPathname,
  joinSearch,
} from './route-pattern-helpers.ts';
import type {
  ExtractProtocol,
  ExtractHostname,
  ExtractPathname,
  ExtractSearch,
  JoinProtocol,
  JoinHostname,
  JoinPathname,
  JoinSearch,
} from './route-pattern-helpers.ts';

//#region EXTRACT specs
describe('extractProtocol', () => {
  it('returns the protocol from a route pattern', () => {
    assert.equal(extractProtocol(''), '');
    assert.equal(extractProtocol('http://'), 'http:');
    assert.equal(extractProtocol('https://'), 'https:');
    assert.equal(extractProtocol('http(s)://'), 'http(s):');
    assert.equal(extractProtocol('http(s)://remix.run'), 'http(s):');
    assert.equal(extractProtocol('http(s)://remix.run/blog'), 'http(s):');
  });
});

type ExtractProtocolSpec = [
  Assert<Equal<ExtractProtocol<''>, ''>>,
  Assert<Equal<ExtractProtocol<'http://'>, 'http:'>>,
  Assert<Equal<ExtractProtocol<'https://'>, 'https:'>>,
  Assert<Equal<ExtractProtocol<'http(s)://'>, 'http(s):'>>,
  Assert<Equal<ExtractProtocol<'http(s)://remix.run'>, 'http(s):'>>,
  Assert<Equal<ExtractProtocol<'http(s)://remix.run/blog'>, 'http(s):'>>,
];

describe('extractHostname', () => {
  it('returns the hostname from a route pattern', () => {
    assert.equal(extractHostname(''), '');
    assert.equal(extractHostname('http://'), '');
    assert.equal(extractHostname('://localhost'), 'localhost');
    assert.equal(extractHostname('http://localhost'), 'localhost');
    assert.equal(extractHostname('http://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://remix.run/'), 'remix.run');
    assert.equal(extractHostname('https://remix.run/blog'), 'remix.run');
    assert.equal(extractHostname('https://remix.run?q'), 'remix.run');
    assert.equal(extractHostname('https://remix.run/?q'), 'remix.run');
    assert.equal(extractHostname('http(s)://remix.run'), 'remix.run');
    assert.equal(extractHostname('http(s)://remix.run/'), 'remix.run');
    assert.equal(extractHostname('http(s)://remix.run/blog'), 'remix.run');
    assert.equal(extractHostname('https://www.remix.run'), 'www.remix.run');
    assert.equal(extractHostname('https://(www.)remix.run'), '(www.)remix.run');
    assert.equal(extractHostname('https://:sub.remix.run'), ':sub.remix.run');
    assert.equal(extractHostname('https://(:sub.)remix.run'), '(:sub.)remix.run');
    assert.equal(extractHostname('https://*sub.remix.run'), '*sub.remix.run');
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
  Assert<Equal<ExtractHostname<'https://remix.run?q'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://remix.run/?q'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'http(s)://remix.run'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'http(s)://remix.run/'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'http(s)://remix.run/blog'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://www.remix.run'>, 'www.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://(www.)remix.run'>, '(www.)remix.run'>>,
  Assert<Equal<ExtractHostname<'https://:sub.remix.run'>, ':sub.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://(:sub.)remix.run'>, '(:sub.)remix.run'>>,
  Assert<Equal<ExtractHostname<'https://*sub.remix.run'>, '*sub.remix.run'>>,
];

describe('extractPathname', () => {
  it('returns the pathname from a route pattern', () => {
    assert.equal(extractPathname(''), '/');
    assert.equal(extractPathname('/'), '/');
    assert.equal(extractPathname('/?'), '/');
    assert.equal(extractPathname('//'), '//');
    assert.equal(extractPathname('a'), '/a');
    assert.equal(extractPathname('/a'), '/a');
    assert.equal(extractPathname('a/b'), '/a/b');
    assert.equal(extractPathname('/a/b'), '/a/b');
    assert.equal(extractPathname('/a/:b'), '/a/:b');
    assert.equal(extractPathname('/a(/b)'), '/a(/b)');
    assert.equal(extractPathname('/a(/:b)'), '/a(/:b)');
    assert.equal(extractPathname('(/a)/b'), '(/a)/b');
    assert.equal(extractPathname('(/a)/:b'), '(/a)/:b');
    assert.equal(extractPathname('(/a)(/b)'), '(/a)(/b)');
    assert.equal(extractPathname('(/a)(/:b)'), '(/a)(/:b)');
    assert.equal(extractPathname('/a/b(/c)'), '/a/b(/c)');
    assert.equal(extractPathname('/a/b/c?'), '/a/b/c');
    assert.equal(extractPathname('/a/b/c?q'), '/a/b/c');
    assert.equal(extractPathname('/a/b/c/?'), '/a/b/c/');
    assert.equal(extractPathname('/a/b/c/?q'), '/a/b/c/');
    assert.equal(extractPathname('/a(/b)/c'), '/a(/b)/c');
    assert.equal(extractPathname('https://remix.run'), '/');
    assert.equal(extractPathname('https://remix.run/a'), '/a');
    assert.equal(extractPathname('https://remix.run?q'), '/');
    assert.equal(extractPathname('https://remix.run/?q'), '/');
    assert.equal(extractPathname('*path'), '/*path');
    assert.equal(extractPathname('/*path'), '/*path');
    assert.equal(extractPathname('*a/more'), '/*a/more');
    assert.equal(extractPathname('/*a/more'), '/*a/more');
    assert.equal(extractPathname('*a/more/*b'), '/*a/more/*b');
    assert.equal(extractPathname('/*a/more/*b'), '/*a/more/*b');
  });
});

type ExtractPathnameSpec = [
  Assert<Equal<ExtractPathname<''>, '/'>>,
  Assert<Equal<ExtractPathname<'/'>, '/'>>,
  Assert<Equal<ExtractPathname<'/?'>, '/'>>,
  Assert<Equal<ExtractPathname<'//'>, '//'>>,
  Assert<Equal<ExtractPathname<'a'>, '/a'>>,
  Assert<Equal<ExtractPathname<'/a'>, '/a'>>,
  Assert<Equal<ExtractPathname<'a/b'>, '/a/b'>>,
  Assert<Equal<ExtractPathname<'/a/b'>, '/a/b'>>,
  Assert<Equal<ExtractPathname<'/a/:b'>, '/a/:b'>>,
  Assert<Equal<ExtractPathname<'/a(/b)'>, '/a(/b)'>>,
  Assert<Equal<ExtractPathname<'/a(/:b)'>, '/a(/:b)'>>,
  Assert<Equal<ExtractPathname<'(/a)/b'>, '(/a)/b'>>,
  Assert<Equal<ExtractPathname<'(/a)/:b'>, '(/a)/:b'>>,
  Assert<Equal<ExtractPathname<'(/a)(/b)'>, '(/a)(/b)'>>,
  Assert<Equal<ExtractPathname<'(/a)(/:b)'>, '(/a)(/:b)'>>,
  Assert<Equal<ExtractPathname<'/a/b(/c)'>, '/a/b(/c)'>>,
  Assert<Equal<ExtractPathname<'/a/b/c?'>, '/a/b/c'>>,
  Assert<Equal<ExtractPathname<'/a/b/c?q'>, '/a/b/c'>>,
  Assert<Equal<ExtractPathname<'/a/b/c/?'>, '/a/b/c/'>>,
  Assert<Equal<ExtractPathname<'/a/b/c/?q'>, '/a/b/c/'>>,
  Assert<Equal<ExtractPathname<'/a(/b)/c'>, '/a(/b)/c'>>,
  Assert<Equal<ExtractPathname<'https://remix.run'>, '/'>>,
  Assert<Equal<ExtractPathname<'https://remix.run/a'>, '/a'>>,
  Assert<Equal<ExtractPathname<'https://remix.run?q'>, '/'>>,
  Assert<Equal<ExtractPathname<'https://remix.run/?q'>, '/'>>,
  Assert<Equal<ExtractPathname<'*path'>, '/*path'>>,
  Assert<Equal<ExtractPathname<'/*path'>, '/*path'>>,
  Assert<Equal<ExtractPathname<'*a/more'>, '/*a/more'>>,
  Assert<Equal<ExtractPathname<'/*a/more'>, '/*a/more'>>,
  Assert<Equal<ExtractPathname<'*a/more/*b'>, '/*a/more/*b'>>,
  Assert<Equal<ExtractPathname<'/*a/more/*b'>, '/*a/more/*b'>>,
];

describe('extractSearch', () => {
  it('returns the search from a route pattern', () => {
    assert.equal(extractSearch(''), '');
    assert.equal(extractSearch('/'), '');
    assert.equal(extractSearch('/?'), '');
    assert.equal(extractSearch('/a/b'), '');
    assert.equal(extractSearch('/a/b?'), '');
    assert.equal(extractSearch('/a/:b'), '');
    assert.equal(extractSearch('/a/:b?'), '');
    assert.equal(extractSearch('/a/b/c?'), '');
    assert.equal(extractSearch('/a/b/c/?'), '');
    assert.equal(extractSearch('/a/b/c?q'), '?q');
    assert.equal(extractSearch('/a/b/c?q=1'), '?q=1');
    assert.equal(extractSearch('https://remix.run?q'), '?q');
    assert.equal(extractSearch('https://remix.run?q=1'), '?q=1');
    assert.equal(extractSearch('https://remix.run/?q'), '?q');
    assert.equal(extractSearch('https://remix.run/?q=1'), '?q=1');
    assert.equal(extractSearch('https://remix.run/a?q'), '?q');
    assert.equal(extractSearch('https://remix.run/a?q=1'), '?q=1');
    assert.equal(extractSearch('https://remix.run/a?q&a'), '?q&a');
    assert.equal(extractSearch('https://remix.run/a?q&a=1'), '?q&a=1');
  });
});

type ExtractSearchSpec = [
  Assert<Equal<ExtractSearch<''>, ''>>,
  Assert<Equal<ExtractSearch<'/'>, ''>>,
  Assert<Equal<ExtractSearch<'/?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/:b'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/:b?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b/c?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b/c/?'>, ''>>,
  Assert<Equal<ExtractSearch<'/a/b/c?q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'/a/b/c?q=1'>, '?q=1'>>,
  Assert<Equal<ExtractSearch<'https://remix.run?q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'https://remix.run?q=1'>, '?q=1'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/?q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/?q=1'>, '?q=1'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/a?q'>, '?q'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/a?q=1'>, '?q=1'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/a?q&a'>, '?q&a'>>,
  Assert<Equal<ExtractSearch<'https://remix.run/a?q&a=1'>, '?q&a=1'>>,
];
//#endregion

//#region JOIN specs
describe('joinProtocol', () => {
  it('joins two protocol patterns', () => {
    assert.equal(joinProtocol('', ''), '');
    assert.equal(joinProtocol('', 'http:'), 'http:');
    assert.equal(joinProtocol('http:', ''), 'http:');
    assert.equal(joinProtocol('http:', 'http:'), 'http:');
    assert.equal(joinProtocol('http:', 'https:'), 'https:');
  });
});

type JoinProtocolSpec = [
  Assert<Equal<JoinProtocol<'', ''>, ''>>,
  Assert<Equal<JoinProtocol<'', 'http:'>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', ''>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', 'http:'>, 'http:'>>,
  Assert<Equal<JoinProtocol<'http:', 'https:'>, 'https:'>>,
];

describe('joinHostname', () => {
  it('joins two hostname patterns', () => {
    assert.equal(joinHostname('', ''), '');
    assert.equal(joinHostname('localhost', ''), 'localhost');
    assert.equal(joinHostname('remix.run', ''), 'remix.run');
    assert.equal(joinHostname('', 'remix.run'), 'remix.run');
    assert.equal(joinHostname('remix.run', 'shopify.com'), 'shopify.com');
  });
});

type JoinHostnameSpec = [
  Assert<Equal<JoinHostname<'', ''>, ''>>,
  Assert<Equal<JoinHostname<'localhost', ''>, 'localhost'>>,
  Assert<Equal<JoinHostname<'remix.run', ''>, 'remix.run'>>,
  Assert<Equal<JoinHostname<'', 'remix.run'>, 'remix.run'>>,
  Assert<Equal<JoinHostname<'remix.run', 'shopify.com'>, 'shopify.com'>>,
];

describe('joinPathname', () => {
  it('joins two pathname patterns', () => {
    assert.equal(joinPathname('/', '/'), '/');
    assert.equal(joinPathname('/', '//'), '//');
    assert.equal(joinPathname('//', '/'), '//');
    assert.equal(joinPathname('/', '/a'), '/a');
    assert.equal(joinPathname('/', '/a/b'), '/a/b');
    assert.equal(joinPathname('/a', '/'), '/a');
    assert.equal(joinPathname('/a/b', '/'), '/a/b');
    assert.equal(joinPathname('/a(/b)', '/'), '/a(/b)');
    assert.equal(joinPathname('/a', '(/b)'), '/a(/b)');
    assert.equal(joinPathname('/a', '/(:b)'), '/a/(:b)');

    assert.equal(joinPathname('/a/', '/'), '/a/');
    assert.equal(joinPathname('/a/', '/b'), '/a/b');
    assert.equal(joinPathname('/a/', '(/b)'), '/a(/b)');
    assert.equal(joinPathname('/a(/b)', '/c'), '/a(/b)/c');
    assert.equal(joinPathname('/a(/b)/', '/c'), '/a(/b)/c');
  });
});

type JoinPathnameSpec = [
  Assert<Equal<JoinPathname<'/', '/'>, '/'>>,
  Assert<Equal<JoinPathname<'/', '//'>, '//'>>,
  Assert<Equal<JoinPathname<'//', '/'>, '//'>>,
  Assert<Equal<JoinPathname<'/', '/a'>, '/a'>>,
  Assert<Equal<JoinPathname<'/', '/a/b'>, '/a/b'>>,
  Assert<Equal<JoinPathname<'/a', '/'>, '/a'>>,
  Assert<Equal<JoinPathname<'/a/b', '/'>, '/a/b'>>,
  Assert<Equal<JoinPathname<'/a(/b)', '/'>, '/a(/b)'>>,
  Assert<Equal<JoinPathname<'/a', '(/b)'>, '/a(/b)'>>,
  Assert<Equal<JoinPathname<'/a', '/(:b)'>, '/a/(:b)'>>,

  Assert<Equal<JoinPathname<'/a/', '/'>, '/a/'>>,
  Assert<Equal<JoinPathname<'/a/', '/b'>, '/a/b'>>,
  Assert<Equal<JoinPathname<'/a/', '(/b)'>, '/a(/b)'>>,
  Assert<Equal<JoinPathname<'/a(/b)', '/c'>, '/a(/b)/c'>>,
  Assert<Equal<JoinPathname<'/a(/b)/', '/c'>, '/a(/b)/c'>>,
];

describe('joinSearch', () => {
  it('joins two search patterns', () => {
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
//#endregion
