import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { toRegExp } from './to-regexp.ts';

// TODO:
// - [ ] test unmatched parens
// - [ ] test params in hostname
// - [ ] test escaping (e.g. `.` in hostname should not be a regex wildcard)
// - [ ] test `*`

describe('toRegExp', () => {
  it('works', () => {
    const { regexp, paramNames } = toRegExp('http(s)://(www.)remix.run/foo(/:bar/baz)');
    assert.deepEqual(paramNames, ['bar']);

    const cases = {
      'http://remix.run/foo': [undefined],
      'https://remix.run/foo': [undefined],
      'http://www.remix.run/foo': [undefined],
      'https://www.remix.run/foo': [undefined],
      'http://remix.run/foo/cool/baz': ['cool'],
      'https://remix.run/foo/cool/baz': ['cool'],
      'http://www.remix.run/foo/cool/baz': ['cool'],
      'https://www.remix.run/foo/cool/baz': ['cool'],
    };

    for (let [url, paramValues] of Object.entries(cases)) {
      const match = regexp.exec(url);
      assert.deepEqual(match?.slice(1), paramValues);
    }
  });

  it('throws on ambiguous params', () => {
    assert.throws(() => toRegExp('http://remix.run/(hello-:world)goodbye'));
  });
});
