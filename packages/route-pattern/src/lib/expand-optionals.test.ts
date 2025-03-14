import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type ExpandOptionals, expandOptionals, ParseError } from './expand-optionals.ts';
import type { Assert, Equal } from '../../test/utils.ts';

describe('expandOptionals', () => {
  it('throws on nested open parens', () => {
    const pattern = '((';
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, never>>;
    assert.throws(
      () => Array.from(expandOptionals(pattern)),
      new ParseError('nested-parenthesis', 1),
    );
  });

  it('throws on unmatched open parens', () => {
    const pattern = '(';
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, never>>;
    assert.throws(
      () => Array.from(expandOptionals(pattern)),
      new ParseError('unmatched-parenthesis', 0),
    );
  });

  it('throws on unmatched open parens after matched parens', () => {
    const pattern = '()(';
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, never>>;
    assert.throws(
      () => Array.from(expandOptionals(pattern)),
      new ParseError('unmatched-parenthesis', 2),
    );
  });

  it('throws on unmatched close parens', () => {
    const pattern = ')';
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, never>>;
    assert.throws(
      () => Array.from(expandOptionals(pattern)),
      new ParseError('unmatched-parenthesis', 0),
    );
  });

  it('throws on unmatched close parens after matched parens', () => {
    const pattern = '())';
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, never>>;
    assert.throws(
      () => Array.from(expandOptionals(pattern)),
      new ParseError('unmatched-parenthesis', 2),
    );
  });

  it('expands one optional into two variants', () => {
    const pattern = '/foo(/bar/:baz)';
    const expected = ['/foo', '/foo/bar/:baz'] as const;
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, (typeof expected)[number]>>;
    assert.deepStrictEqual(Array.from(expandOptionals(pattern)), expected);
  });

  it('expands two optionals into four variants', () => {
    const pattern = 'a(b)c(d)e';
    const expected = ['ace', 'abce', 'acde', 'abcde'] as const;
    type T = Assert<Equal<ExpandOptionals<typeof pattern>, (typeof expected)[number]>>;
    assert.deepStrictEqual(Array.from(expandOptionals(pattern)), expected);
  });
});
