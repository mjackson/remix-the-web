import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal } from '../../test/utils.ts';

import { splitPattern, joinPattern } from './pattern-utils.ts';
import type { SplitPattern, JoinPattern } from './pattern-utils.ts';

describe('splitPattern', () => {
  it('splits the pattern into protocol, hostname, pathname, and search', () =>
    // prettier-ignore
    {
    assert.deepEqual(splitPattern(''), ['', '', '/', '']);
    assert.deepEqual(splitPattern('/'), ['', '', '/', '']);
    assert.deepEqual(splitPattern('?'), ['', '', '/', '']);
    assert.deepEqual(splitPattern('/?'), ['', '', '/', '']);
    assert.deepEqual(splitPattern('/?q'), ['', '', '/', '?q']);

    assert.deepEqual(splitPattern('/users'), ['', '', '/users', '']);
    assert.deepEqual(splitPattern('/users/'), ['', '', '/users/', '']);
    assert.deepEqual(splitPattern('/users?'), ['', '', '/users', '']);
    assert.deepEqual(splitPattern('/users/?'), ['', '', '/users/', '']);
    assert.deepEqual(splitPattern('/users/?q'), ['', '', '/users/', '?q']);

    assert.deepEqual(splitPattern('/users/:id'), ['', '', '/users/:id', '']);
    assert.deepEqual(splitPattern('/users/:id/'), ['', '', '/users/:id/', '']);
    assert.deepEqual(splitPattern('/users/:id?'), ['', '', '/users/:id', '']);
    assert.deepEqual(splitPattern('/users/:id/?'), ['', '', '/users/:id/', '']);
    assert.deepEqual(splitPattern('/users/:id?q'), ['', '', '/users/:id', '?q']);

    assert.deepEqual(splitPattern('://remix.run'), ['', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('://remix.run/'), ['', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('://remix.run?'), ['', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('://remix.run/?'), ['', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('://remix.run/?q'), ['', 'remix.run', '/', '?q']);

    assert.deepEqual(splitPattern('://remix.run/users'), ['', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('://remix.run/users/'), ['', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('://remix.run/users?'), ['', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('://remix.run/users/?'), ['', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('://remix.run/users/?q'), ['', 'remix.run', '/users/', '?q']);

    assert.deepEqual(splitPattern('://remix.run/users/:id'), ['', 'remix.run', '/users/:id', '']);
    assert.deepEqual(splitPattern('://remix.run/users/:id/'), ['', 'remix.run', '/users/:id/', '']);
    assert.deepEqual(splitPattern('://remix.run/users/:id?'), ['', 'remix.run', '/users/:id', '']);
    assert.deepEqual(splitPattern('://remix.run/users/:id/?'), ['', 'remix.run', '/users/:id/', '']);
    assert.deepEqual(splitPattern('://remix.run/users/:id?q'), ['', 'remix.run', '/users/:id', '?q']);

    assert.deepEqual(splitPattern('://remix.run/users(/:id)'), ['', 'remix.run', '/users(/:id)', '']);
    assert.deepEqual(splitPattern('://remix.run/users(/:id)/'), ['', 'remix.run', '/users(/:id)/', '']);
    assert.deepEqual(splitPattern('://remix.run/users(/:id)?'), ['', 'remix.run', '/users(/:id)', '']);
    assert.deepEqual(splitPattern('://remix.run/users(/:id)/?'), ['', 'remix.run', '/users(/:id)/', '']);
    assert.deepEqual(splitPattern('://remix.run/users(/:id)?q'), ['', 'remix.run', '/users(/:id)', '?q']);

    assert.deepEqual(splitPattern('https://remix.run'), ['https:', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('https://remix.run/'), ['https:', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('https://remix.run?'), ['https:', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('https://remix.run/?'), ['https:', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('https://remix.run/?q'), ['https:', 'remix.run', '/', '?q']);

    assert.deepEqual(splitPattern('http(s)://remix.run'), ['http(s):', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/'), ['http(s):', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run?'), ['http(s):', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/?'), ['http(s):', 'remix.run', '/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/?q'), ['http(s):', 'remix.run', '/', '?q']);

    assert.deepEqual(splitPattern('https://remix.run/users'), ['https:', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('https://remix.run/users/'), ['https:', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('https://remix.run/users?'), ['https:', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('https://remix.run/users/?'), ['https:', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('https://remix.run/users/?q'), ['https:', 'remix.run', '/users/', '?q']);

    assert.deepEqual(splitPattern('https://remix.run/users(/:id)'), ['https:', 'remix.run', '/users(/:id)', '']);
    assert.deepEqual(splitPattern('https://remix.run/users(/:id)/'), ['https:', 'remix.run', '/users(/:id)/', '']);
    assert.deepEqual(splitPattern('https://remix.run/users(/:id)?'), ['https:', 'remix.run', '/users(/:id)', '']);
    assert.deepEqual(splitPattern('https://remix.run/users(/:id)/?'), ['https:', 'remix.run', '/users(/:id)/', '']);
    assert.deepEqual(splitPattern('https://remix.run/users(/:id)?q'), ['https:', 'remix.run', '/users(/:id)', '?q']);

    assert.deepEqual(splitPattern('http(s)://remix.run/users'), ['http(s):', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/users/'), ['http(s):', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/users?'), ['http(s):', 'remix.run', '/users', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/users/?'), ['http(s):', 'remix.run', '/users/', '']);
    assert.deepEqual(splitPattern('http(s)://remix.run/users/?q'), ['http(s):', 'remix.run', '/users/', '?q']);
  });
});

// prettier-ignore
type SplitPatternSpec = [
  Assert<Equal<SplitPattern<''>, ['', '', '/', '']>>,
  Assert<Equal<SplitPattern<'/'>, ['', '', '/', '']>>,
  Assert<Equal<SplitPattern<'?'>, ['', '', '/', '']>>,
  Assert<Equal<SplitPattern<'/?'>, ['', '', '/', '']>>,
  Assert<Equal<SplitPattern<'/?q'>, ['', '', '/', '?q']>>,

  Assert<Equal<SplitPattern<'/users'>, ['', '', '/users', '']>>,
  Assert<Equal<SplitPattern<'/users/'>, ['', '', '/users/', '']>>,
  Assert<Equal<SplitPattern<'/users?'>, ['', '', '/users', '']>>,
  Assert<Equal<SplitPattern<'/users/?'>, ['', '', '/users/', '']>>,
  Assert<Equal<SplitPattern<'/users/?q'>, ['', '', '/users/', '?q']>>,

  Assert<Equal<SplitPattern<'/users/:id'>, ['', '', '/users/:id', '']>>,
  Assert<Equal<SplitPattern<'/users/:id/'>, ['', '', '/users/:id/', '']>>,
  Assert<Equal<SplitPattern<'/users/:id?'>, ['', '', '/users/:id', '']>>,
  Assert<Equal<SplitPattern<'/users/:id/?'>, ['', '', '/users/:id/', '']>>,
  Assert<Equal<SplitPattern<'/users/:id?q'>, ['', '', '/users/:id', '?q']>>,

  Assert<Equal<SplitPattern<'://remix.run'>, ['', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/'>, ['', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run?'>, ['', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/?'>, ['', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/?q'>, ['', 'remix.run', '/', '?q']>>,

  Assert<Equal<SplitPattern<'://remix.run/users'>, ['', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/'>, ['', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users?'>, ['', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/?'>, ['', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/?q'>, ['', 'remix.run', '/users/', '?q']>>,

  Assert<Equal<SplitPattern<'://remix.run/users/:id'>, ['', 'remix.run', '/users/:id', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/:id/'>, ['', 'remix.run', '/users/:id/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/:id?'>, ['', 'remix.run', '/users/:id', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/:id/?'>, ['', 'remix.run', '/users/:id/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users/:id?q'>, ['', 'remix.run', '/users/:id', '?q']>>,

  Assert<Equal<SplitPattern<'://remix.run/users(/:id)'>, ['', 'remix.run', '/users(/:id)', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users(/:id)/'>, ['', 'remix.run', '/users(/:id)/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users(/:id)?'>, ['', 'remix.run', '/users(/:id)', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users(/:id)/?'>, ['', 'remix.run', '/users(/:id)/', '']>>,
  Assert<Equal<SplitPattern<'://remix.run/users(/:id)?q'>, ['', 'remix.run', '/users(/:id)', '?q']>>,

  Assert<Equal<SplitPattern<'https://remix.run'>, ['https:', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/'>, ['https:', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run?'>, ['https:', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/?'>, ['https:', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/?q'>, ['https:', 'remix.run', '/', '?q']>>,

  Assert<Equal<SplitPattern<'http(s)://remix.run'>, ['http(s):', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/'>, ['http(s):', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run?'>, ['http(s):', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/?'>, ['http(s):', 'remix.run', '/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/?q'>, ['http(s):', 'remix.run', '/', '?q']>>,

  Assert<Equal<SplitPattern<'https://remix.run/users'>, ['https:', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users/'>, ['https:', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users?'>, ['https:', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users/?'>, ['https:', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users/?q'>, ['https:', 'remix.run', '/users/', '?q']>>,

  Assert<Equal<SplitPattern<'https://remix.run/users(/:id)'>, ['https:', 'remix.run', '/users(/:id)', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users(/:id)/'>, ['https:', 'remix.run', '/users(/:id)/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users(/:id)?'>, ['https:', 'remix.run', '/users(/:id)', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users(/:id)/?'>, ['https:', 'remix.run', '/users(/:id)/', '']>>,
  Assert<Equal<SplitPattern<'https://remix.run/users(/:id)?q'>, ['https:', 'remix.run', '/users(/:id)', '?q']>>,

  Assert<Equal<SplitPattern<'http(s)://remix.run/users'>, ['http(s):', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/users/'>, ['http(s):', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/users?'>, ['http(s):', 'remix.run', '/users', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/users/?'>, ['http(s):', 'remix.run', '/users/', '']>>,
  Assert<Equal<SplitPattern<'http(s)://remix.run/users/?q'>, ['http(s):', 'remix.run', '/users/', '?q']>>,
];

describe('joinPattern', () => {
  it('joins the protocol, hostname, pathname, and search into a pattern', () =>
    // prettier-ignore
    {
    assert.equal(joinPattern(['', '', '', '']), '');
    assert.equal(joinPattern(['', '', '/', '']), '/');
    assert.equal(joinPattern(['', '', '', '?']), '?');
    assert.equal(joinPattern(['', '', '/', '?']), '/?');
    assert.equal(joinPattern(['', '', '/', '?q']), '/?q');

    assert.equal(joinPattern(['', '', '/users', '']), '/users');
    assert.equal(joinPattern(['', '', '/users/', '']), '/users/');
    assert.equal(joinPattern(['', '', '/users', '?']), '/users?');
    assert.equal(joinPattern(['', '', '/users/', '?']), '/users/?');
    assert.equal(joinPattern(['', '', '/users/', '?q']), '/users/?q');

    assert.equal(joinPattern(['', '', '/users/:id', '']), '/users/:id');
    assert.equal(joinPattern(['', '', '/users/:id/', '']), '/users/:id/');
    assert.equal(joinPattern(['', '', '/users/:id', '?']), '/users/:id?');
    assert.equal(joinPattern(['', '', '/users/:id/', '?']), '/users/:id/?');
    assert.equal(joinPattern(['', '', '/users/:id/', '?q']), '/users/:id/?q');

    assert.equal(joinPattern(['', 'remix.run', '', '']), '://remix.run');
    assert.equal(joinPattern(['', 'remix.run', '/', '']), '://remix.run/');
    assert.equal(joinPattern(['', 'remix.run', '', '?']), '://remix.run?');
    assert.equal(joinPattern(['', 'remix.run', '/', '?']), '://remix.run/?');
    assert.equal(joinPattern(['', 'remix.run', '/', '?q']), '://remix.run/?q');

    assert.equal(joinPattern(['', 'remix.run', '/users', '']), '://remix.run/users');
    assert.equal(joinPattern(['', 'remix.run', '/users/', '']), '://remix.run/users/');
    assert.equal(joinPattern(['', 'remix.run', '/users', '?']), '://remix.run/users?');
    assert.equal(joinPattern(['', 'remix.run', '/users/', '?']), '://remix.run/users/?');
    assert.equal(joinPattern(['', 'remix.run', '/users/', '?q']), '://remix.run/users/?q');

    assert.equal(joinPattern(['', 'remix.run', '/users/:id', '']), '://remix.run/users/:id');
    assert.equal(joinPattern(['', 'remix.run', '/users/:id/', '']), '://remix.run/users/:id/');
    assert.equal(joinPattern(['', 'remix.run', '/users/:id', '?']), '://remix.run/users/:id?');
    assert.equal(joinPattern(['', 'remix.run', '/users/:id/', '?']), '://remix.run/users/:id/?');
    assert.equal(joinPattern(['', 'remix.run', '/users/:id/', '?q']), '://remix.run/users/:id/?q');

    assert.equal(joinPattern(['', 'remix.run', '/users(/:id)', '']), '://remix.run/users(/:id)');
    assert.equal(joinPattern(['', 'remix.run', '/users(/:id)/', '']), '://remix.run/users(/:id)/');
    assert.equal(joinPattern(['', 'remix.run', '/users(/:id)', '?']), '://remix.run/users(/:id)?');
    assert.equal(joinPattern(['', 'remix.run', '/users(/:id)/', '?']), '://remix.run/users(/:id)/?');
    assert.equal(joinPattern(['', 'remix.run', '/users(/:id)', '?q']), '://remix.run/users(/:id)?q');

    assert.equal(joinPattern(['https:', 'remix.run', '', '']), 'https://remix.run');
    assert.equal(joinPattern(['https:', 'remix.run', '/', '']), 'https://remix.run/');
    assert.equal(joinPattern(['https:', 'remix.run', '', '?']), 'https://remix.run?');
    assert.equal(joinPattern(['https:', 'remix.run', '/', '?']), 'https://remix.run/?');
    assert.equal(joinPattern(['https:', 'remix.run', '/', '?q']), 'https://remix.run/?q');

    assert.equal(joinPattern(['http(s):', 'remix.run', '', '']), 'http(s)://remix.run');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/', '']), 'http(s)://remix.run/');
    assert.equal(joinPattern(['http(s):', 'remix.run', '', '?']), 'http(s)://remix.run?');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/', '?']), 'http(s)://remix.run/?');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/', '?q']), 'http(s)://remix.run/?q');

    assert.equal(joinPattern(['https:', 'remix.run', '/users', '']), 'https://remix.run/users');
    assert.equal(joinPattern(['https:', 'remix.run', '/users/', '']), 'https://remix.run/users/');
    assert.equal(joinPattern(['https:', 'remix.run', '/users', '?']), 'https://remix.run/users?');
    assert.equal(joinPattern(['https:', 'remix.run', '/users/', '?']), 'https://remix.run/users/?');
    assert.equal(joinPattern(['https:', 'remix.run', '/users/', '?q']), 'https://remix.run/users/?q');

    assert.equal(joinPattern(['https:', 'remix.run', '/users(/:id)', '']), 'https://remix.run/users(/:id)');
    assert.equal(joinPattern(['https:', 'remix.run', '/users(/:id)/', '']), 'https://remix.run/users(/:id)/');
    assert.equal(joinPattern(['https:', 'remix.run', '/users(/:id)', '?']), 'https://remix.run/users(/:id)?');
    assert.equal(joinPattern(['https:', 'remix.run', '/users(/:id)/', '?']), 'https://remix.run/users(/:id)/?');
    assert.equal(joinPattern(['https:', 'remix.run', '/users(/:id)/', '?q']), 'https://remix.run/users(/:id)/?q');

    assert.equal(joinPattern(['http(s):', 'remix.run', '/users', '']), 'http(s)://remix.run/users');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/users/', '']), 'http(s)://remix.run/users/');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/users', '?']), 'http(s)://remix.run/users?');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/users/', '?']), 'http(s)://remix.run/users/?');
    assert.equal(joinPattern(['http(s):', 'remix.run', '/users/', '?q']), 'http(s)://remix.run/users/?q');
  });
});

// prettier-ignore
type JoinPatternSpec = [
  Assert<Equal<JoinPattern<['', '', '', '']>, ''>>,
  Assert<Equal<JoinPattern<['', '', '/', '']>, '/'>>,
  Assert<Equal<JoinPattern<['', '', '', '?']>, '?'>>,
  Assert<Equal<JoinPattern<['', '', '/', '?']>, '/?'>>,
  Assert<Equal<JoinPattern<['', '', '/', '?q']>, '/?q'>>,

  Assert<Equal<JoinPattern<['', '', '/users', '']>, '/users'>>,
  Assert<Equal<JoinPattern<['', '', '/users/', '']>, '/users/'>>,
  Assert<Equal<JoinPattern<['', '', '/users', '?']>, '/users?'>>,
  Assert<Equal<JoinPattern<['', '', '/users/', '?']>, '/users/?'>>,
  Assert<Equal<JoinPattern<['', '', '/users/', '?q']>, '/users/?q'>>,

  Assert<Equal<JoinPattern<['', '', '/users/:id', '']>, '/users/:id'>>,
  Assert<Equal<JoinPattern<['', '', '/users/:id/', '']>, '/users/:id/'>>,
  Assert<Equal<JoinPattern<['', '', '/users/:id', '?']>, '/users/:id?'>>,
  Assert<Equal<JoinPattern<['', '', '/users/:id/', '?']>, '/users/:id/?'>>,
  Assert<Equal<JoinPattern<['', '', '/users/:id/', '?q']>, '/users/:id/?q'>>,

  Assert<Equal<JoinPattern<['', 'remix.run', '', '']>, '://remix.run'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/', '']>, '://remix.run/'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '', '?']>, '://remix.run?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/', '?']>, '://remix.run/?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/', '?q']>, '://remix.run/?q'>>,

  Assert<Equal<JoinPattern<['', 'remix.run', '/users', '']>, '://remix.run/users'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/', '']>, '://remix.run/users/'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users', '?']>, '://remix.run/users?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/', '?']>, '://remix.run/users/?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/', '?q']>, '://remix.run/users/?q'>>,

  Assert<Equal<JoinPattern<['', 'remix.run', '/users/:id', '']>, '://remix.run/users/:id'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/:id/', '']>, '://remix.run/users/:id/'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/:id', '?']>, '://remix.run/users/:id?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/:id/', '?']>, '://remix.run/users/:id/?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users/:id/', '?q']>, '://remix.run/users/:id/?q'>>,

  Assert<Equal<JoinPattern<['', 'remix.run', '/users(/:id)', '']>, '://remix.run/users(/:id)'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users(/:id)/', '']>, '://remix.run/users(/:id)/'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users(/:id)', '?']>, '://remix.run/users(/:id)?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users(/:id)/', '?']>, '://remix.run/users(/:id)/?'>>,
  Assert<Equal<JoinPattern<['', 'remix.run', '/users(/:id)', '?q']>, '://remix.run/users(/:id)?q'>>,

  Assert<Equal<JoinPattern<['https:', 'remix.run', '', '']>, 'https://remix.run'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/', '']>, 'https://remix.run/'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '', '?']>, 'https://remix.run?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/', '?']>, 'https://remix.run/?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/', '?q']>, 'https://remix.run/?q'>>,

  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users', '']>, 'https://remix.run/users'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users/', '']>, 'https://remix.run/users/'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users', '?']>, 'https://remix.run/users?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users/', '?']>, 'https://remix.run/users/?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users/', '?q']>, 'https://remix.run/users/?q'>>,

  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users(/:id)', '']>, 'https://remix.run/users(/:id)'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users(/:id)/', '']>, 'https://remix.run/users(/:id)/'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users(/:id)', '?']>, 'https://remix.run/users(/:id)?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users(/:id)/', '?']>, 'https://remix.run/users(/:id)/?'>>,
  Assert<Equal<JoinPattern<['https:', 'remix.run', '/users(/:id)/', '?q']>, 'https://remix.run/users(/:id)/?q'>>,

  Assert<Equal<JoinPattern<['http(s):', 'remix.run', '', '']>, 'http(s)://remix.run'>>,
  Assert<Equal<JoinPattern<['http(s):', 'remix.run', '/', '']>, 'http(s)://remix.run/'>>,
  Assert<Equal<JoinPattern<['http(s):', 'remix.run', '', '?']>, 'http(s)://remix.run?'>>,
  Assert<Equal<JoinPattern<['http(s):', 'remix.run', '/', '?']>, 'http(s)://remix.run/?'>>,
  Assert<Equal<JoinPattern<['http(s):', 'remix.run', '/', '?q']>, 'http(s)://remix.run/?q'>>,
];
