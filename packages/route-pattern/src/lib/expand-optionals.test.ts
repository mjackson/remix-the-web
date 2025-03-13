import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandOptionals, ParseError } from './expand-optionals.ts';

describe('expand optionals', () => {
  it('throws on nested open parens', () => {
    assert.throws(() => Array.from(expandOptionals('((')), new ParseError('nested-parenthesis', 1));
  });

  it('throws on unmatched open parens', () => {
    assert.throws(
      () => Array.from(expandOptionals('(')),
      new ParseError('unmatched-parenthesis', 0),
    );
    assert.throws(
      () => Array.from(expandOptionals('()(')),
      new ParseError('unmatched-parenthesis', 2),
    );
  });

  it('throws on unmatched close parens', () => {
    assert.throws(
      () => Array.from(expandOptionals(')')),
      new ParseError('unmatched-parenthesis', 0),
    );
    assert.throws(
      () => Array.from(expandOptionals('())')),
      new ParseError('unmatched-parenthesis', 2),
    );
  });

  it('expands optionals into multiple patterns', () => {
    assert.deepStrictEqual(Array.from(expandOptionals('/foo(/bar/:baz)')), [
      '/foo',
      '/foo/bar/:baz',
    ]);
    assert.deepStrictEqual(Array.from(expandOptionals('a(b)c(d)e')), [
      'ace',
      'abce',
      'acde',
      'abcde',
    ]);
  });
});
