import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type ExpandOptionals, expandOptionals, ParseError } from './expand-optionals.ts';
import type { Assert, Equal } from '../../test/utils.ts';

describe('expandOptionals', () => {
  it('throws on nested open parens', () => {
    assert.throws(() => expandOptionals('(('), new ParseError('nested-parenthesis', 1));
    type T = Assert<Equal<ExpandOptionals<'(('>, never>>;
  });

  it('throws on unmatched open parens', () => {
    assert.throws(() => expandOptionals('('), new ParseError('unmatched-parenthesis', 0));
    type T1 = Assert<Equal<ExpandOptionals<'('>, never>>;
    assert.throws(() => expandOptionals('()('), new ParseError('unmatched-parenthesis', 2));
    type T2 = Assert<Equal<ExpandOptionals<'()('>, never>>;
  });

  it('throws on unmatched close parens', () => {
    assert.throws(() => expandOptionals(')'), new ParseError('unmatched-parenthesis', 0));
    type T1 = Assert<Equal<ExpandOptionals<')'>, never>>;
    assert.throws(() => expandOptionals('())'), new ParseError('unmatched-parenthesis', 2));
    type T2 = Assert<Equal<ExpandOptionals<'())'>, never>>;
  });

  it('expands optionals into multiple patterns', () => {
    assert.deepStrictEqual(expandOptionals('/foo(/bar/:baz)'), new Set(['/foo', '/foo/bar/:baz']));
    type T1 = Assert<Equal<ExpandOptionals<'/foo(/bar/:baz)'>, '/foo' | '/foo/bar/:baz'>>;
    assert.deepStrictEqual(expandOptionals('a(b)c(d)e'), new Set(['ace', 'acde', 'abce', 'abcde']));
    type T2 = Assert<Equal<ExpandOptionals<'a(b)c(d)e'>, 'ace' | 'acde' | 'abce' | 'abcde'>>;
  });
});
