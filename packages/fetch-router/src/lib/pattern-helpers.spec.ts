/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import {
  ExtractProtocol,
  extractProtocol,
  ExtractHostname,
  extractHostname,
  ExtractPathname,
  extractPathname,
  ExtractSearch,
  extractSearch,
  NormalizeProtocol,
  normalizeProtocol,
  NormalizeHostname,
  normalizeHostname,
  NormalizePathname,
  normalizePathname,
  NormalizeSearch,
  normalizeSearch,
  JoinPattern,
  JoinProtocol,
  joinProtocol,
  JoinHostname,
  joinHostname,
  JoinPathname,
  joinPathname,
  JoinSearch,
  joinSearch,
} from './pattern-helpers.js';

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
  Assert<Equal<ExtractHostname<'https?://remix.run'>, 'remix.run'>>,
  Assert<Equal<ExtractHostname<'https://*.remix.run'>, '*.remix.run'>>,
  Assert<Equal<ExtractHostname<'https://:sub.remix.run'>, ':sub.remix.run'>>,
  Assert<Equal<ExtractHostname<'https?://remix.run/blog'>, 'remix.run'>>,
];

describe('extractHostname', () => {
  it('returns the hostname from a pattern', () => {
    assert.equal(extractHostname(''), '');
    assert.equal(extractHostname('http://'), '');
    assert.equal(extractHostname('://localhost'), 'localhost');
    assert.equal(extractHostname('http://localhost'), 'localhost');
    assert.equal(extractHostname('http://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://remix.run'), 'remix.run');
    assert.equal(extractHostname('https?://remix.run'), 'remix.run');
    assert.equal(extractHostname('https://*.remix.run'), '*.remix.run');
    assert.equal(extractHostname('https://:sub.remix.run'), ':sub.remix.run');
    assert.equal(extractHostname('https?://remix.run/blog'), 'remix.run');
  });
});

type ExtractPathnameSpec = [
  Assert<Equal<ExtractPathname<''>, ''>>,
  Assert<Equal<ExtractPathname<'/'>, '/'>>,
  Assert<Equal<ExtractPathname<'/?'>, '/'>>,
  Assert<Equal<ExtractPathname<'/??'>, '/'>>,
  Assert<Equal<ExtractPathname<'//'>, '//'>>,
  Assert<Equal<ExtractPathname<'/a'>, '/a'>>,
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
  Assert<Equal<ExtractPathname<'https://remix.run/a'>, '/a'>>,
];

describe('extractPathname', () => {
  it('returns the pathname from a combined pathname + search pattern', () => {
    assert.equal(extractPathname(''), '');
    assert.equal(extractPathname('/'), '/');
    assert.equal(extractPathname('/?'), '/');
    assert.equal(extractPathname('/??'), '/');
    assert.equal(extractPathname('//'), '//');
    assert.equal(extractPathname('/a'), '/a');
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

//#region NORMALIZE specs
type NormalizeProtocolSpec = [
  Assert<Equal<NormalizeProtocol<''>, ''>>,
  Assert<Equal<NormalizeProtocol<'http'>, 'http:'>>,
  Assert<Equal<NormalizeProtocol<'HTTP'>, 'http:'>>,
  Assert<Equal<NormalizeProtocol<'http:'>, 'http:'>>,
  Assert<Equal<NormalizeProtocol<'https'>, 'https:'>>,
  Assert<Equal<NormalizeProtocol<'HTTPS'>, 'https:'>>,
  Assert<Equal<NormalizeProtocol<'https:'>, 'https:'>>,
];

describe('normalizeProtocol', () => {
  it('returns a normalized protocol', () => {
    assert.equal(normalizeProtocol(''), '');
    assert.equal(normalizeProtocol('http'), 'http:');
    assert.equal(normalizeProtocol('HTTP'), 'http:');
    assert.equal(normalizeProtocol('http:'), 'http:');
    assert.equal(normalizeProtocol('https'), 'https:');
    assert.equal(normalizeProtocol('HTTPS'), 'https:');
    assert.equal(normalizeProtocol('https:'), 'https:');
  });
});

type NormalizeHostnameSpec = [
  Assert<Equal<NormalizeHostname<''>, ''>>,
  Assert<Equal<NormalizeHostname<'localhost'>, 'localhost'>>,
  Assert<Equal<NormalizeHostname<'LOCALHOST'>, 'localhost'>>,
  Assert<Equal<NormalizeHostname<'remix.run'>, 'remix.run'>>,
  Assert<Equal<NormalizeHostname<'REMIX.RUN'>, 'remix.run'>>,
  Assert<Equal<NormalizeHostname<'www.remix.run'>, 'www.remix.run'>>,
  Assert<Equal<NormalizeHostname<'www?.remix.run'>, 'www?.remix.run'>>,
  Assert<Equal<NormalizeHostname<':sub.remix.run'>, ':sub.remix.run'>>,
  Assert<Equal<NormalizeHostname<':sub?.remix.run'>, ':sub?.remix.run'>>,
  Assert<Equal<NormalizeHostname<'*.remix.run'>, '*.remix.run'>>,
];

describe('normalizeHostname', () => {
  it('returns a normalized hostname', () => {
    assert.equal(normalizeHostname(''), '');
    assert.equal(normalizeHostname('localhost'), 'localhost');
    assert.equal(normalizeHostname('LOCALHOST'), 'localhost');
    assert.equal(normalizeHostname('remix.run'), 'remix.run');
    assert.equal(normalizeHostname('REMIX.RUN'), 'remix.run');
    assert.equal(normalizeHostname('www.remix.run'), 'www.remix.run');
    assert.equal(normalizeHostname('www?.remix.run'), 'www?.remix.run');
    assert.equal(normalizeHostname(':sub.remix.run'), ':sub.remix.run');
    assert.equal(normalizeHostname(':sub?.remix.run'), ':sub?.remix.run');
    assert.equal(normalizeHostname('*.remix.run'), '*.remix.run');
  });
});

type NormalizePathnameSpec = [
  Assert<Equal<NormalizePathname<''>, '/'>>,
  Assert<Equal<NormalizePathname<'/'>, '/'>>,
  Assert<Equal<NormalizePathname<'//'>, '//'>>,
  Assert<Equal<NormalizePathname<'///'>, '///'>>,
  Assert<Equal<NormalizePathname<'/a'>, '/a'>>,
  Assert<Equal<NormalizePathname<'/a/'>, '/a/'>>,
  Assert<Equal<NormalizePathname<'/a/b'>, '/a/b'>>,
  Assert<Equal<NormalizePathname<'/a/b/'>, '/a/b/'>>,
  Assert<Equal<NormalizePathname<'//a'>, '//a'>>,
  Assert<Equal<NormalizePathname<'//a/'>, '//a/'>>,
  Assert<Equal<NormalizePathname<'//a/b'>, '//a/b'>>,
  Assert<Equal<NormalizePathname<'//a/b/'>, '//a/b/'>>,
  Assert<Equal<NormalizePathname<'/a//'>, '/a//'>>,
  Assert<Equal<NormalizePathname<'/a//b'>, '/a//b'>>,
  Assert<Equal<NormalizePathname<'/a//b/'>, '/a//b/'>>,
  // TODO: normalize .. and . segments
  // Assert<Equal<NormalizePathname<'/a/./b'>, '/a/b'>>,
  // Assert<Equal<NormalizePathname<'/a/././b'>, '/a/b'>>,
  // Assert<Equal<NormalizePathname<'/a/./b/./c'>, '/a/b/c'>>,
  // Assert<Equal<NormalizePathname<'/a/../b'>, '/b'>>,
  // Assert<Equal<NormalizePathname<'/a/../b/'>, '/b/'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../c'>, '/a/c'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../c/'>, '/a/c/'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../c'>, '/c'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../c/'>, '/c/'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c'>, '/c'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c/'>, '/c/'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c/../d'>, '/d'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c/../d/'>, '/d/'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c/../d/../e'>, '/e'>>,
  // Assert<Equal<NormalizePathname<'/a/b/../../../c/../d/../e/'>, '/e/'>>,
  Assert<Equal<NormalizePathname<'*'>, '/*'>>,
  Assert<Equal<NormalizePathname<'/*'>, '/*'>>,
];

describe('normalizePathname', () => {
  it('returns a normalized pathname', () => {
    assert.equal(normalizePathname(''), '/');
    assert.equal(normalizePathname('/'), '/');
    assert.equal(normalizePathname('//'), '//');
    assert.equal(normalizePathname('///'), '///');
    assert.equal(normalizePathname('/a'), '/a');
    assert.equal(normalizePathname('/a/'), '/a/');
    assert.equal(normalizePathname('/a/b'), '/a/b');
    assert.equal(normalizePathname('/a/b/'), '/a/b/');
    assert.equal(normalizePathname('//a'), '//a');
    assert.equal(normalizePathname('//a/'), '//a/');
    assert.equal(normalizePathname('//a/b'), '//a/b');
    assert.equal(normalizePathname('//a/b/'), '//a/b/');
    assert.equal(normalizePathname('/a//'), '/a//');
    assert.equal(normalizePathname('/a//b'), '/a//b');
    assert.equal(normalizePathname('/a//b/'), '/a//b/');
    assert.equal(normalizePathname('/a/./b'), '/a/b');
    assert.equal(normalizePathname('/a/././b'), '/a/b');
    assert.equal(normalizePathname('/a/./b/./c'), '/a/b/c');
    assert.equal(normalizePathname('/a/../b'), '/b');
    assert.equal(normalizePathname('/a/../b/'), '/b/');
    assert.equal(normalizePathname('/a/b/../c'), '/a/c');
    assert.equal(normalizePathname('/a/b/../c/'), '/a/c/');
    assert.equal(normalizePathname('/a/b/../../c'), '/c');
    assert.equal(normalizePathname('/a/b/../../c/'), '/c/');
    assert.equal(normalizePathname('/a/b/../../../c'), '/c');
    assert.equal(normalizePathname('/a/b/../../../c/'), '/c/');
    assert.equal(normalizePathname('/a/b/../../../c/../d'), '/d');
    assert.equal(normalizePathname('/a/b/../../../c/../d/'), '/d/');
    assert.equal(normalizePathname('/a/b/../../../c/../d/../e'), '/e');
    assert.equal(normalizePathname('/a/b/../../../c/../d/../e/'), '/e/');
    assert.equal(normalizePathname('*'), '/*');
    assert.equal(normalizePathname('/*'), '/*');
  });
});

type NormalizeSearchSpec = [
  Assert<Equal<NormalizeSearch<''>, ''>>,
  Assert<Equal<NormalizeSearch<'?'>, ''>>,
  Assert<Equal<NormalizeSearch<'??'>, ''>>,
  Assert<Equal<NormalizeSearch<'q'>, '?q'>>,
  Assert<Equal<NormalizeSearch<'?q'>, '?q'>>,
  Assert<Equal<NormalizeSearch<'?q='>, '?q'>>,
  Assert<Equal<NormalizeSearch<'??q'>, '?q'>>,
  Assert<Equal<NormalizeSearch<'??q='>, '?q'>>,
  Assert<Equal<NormalizeSearch<'?q=remix'>, '?q=remix'>>,
  Assert<Equal<NormalizeSearch<'?q=remix&rocks'>, '?q=remix&rocks'>>,
];

describe('normalizeSearch', () => {
  it('returns a normalized search', () => {
    assert.equal(normalizeSearch(''), '');
    assert.equal(normalizeSearch('?'), '');
    assert.equal(normalizeSearch('??'), '');
    assert.equal(normalizeSearch('q'), '?q');
    assert.equal(normalizeSearch('?q'), '?q');
    assert.equal(normalizeSearch('?q='), '?q');
    assert.equal(normalizeSearch('??q'), '?q');
    assert.equal(normalizeSearch('??q='), '?q');
    assert.equal(normalizeSearch('?q=remix'), '?q=remix');
    assert.equal(normalizeSearch('?q=remix&rocks'), '?q=remix&rocks');
  });
});
//#endregion

//#region JOIN specs
type JoinPatternSpec = [
  Assert<Equal<JoinPattern<'', ''>, ''>>,
  Assert<Equal<JoinPattern<'http://remix.run', ''>, 'http://remix.run'>>,
  Assert<Equal<JoinPattern<'', 'http://remix.run'>, 'http://remix.run'>>,
  Assert<Equal<JoinPattern<'/a', '/b'>, '/a/b'>>,
];

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
