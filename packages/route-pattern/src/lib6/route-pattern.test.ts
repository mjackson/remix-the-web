import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { RoutePattern } from './route-pattern.ts';
import { ParseError } from './errors.ts';

describe('RoutePattern', () => {
  describe('parse', () => {
    it('errors on unmatched parens', () => {
      assert.throws(
        () => RoutePattern.parse('htt(ps://:sub.remix.run/products/:id'),
        //                        012^
        new ParseError('paren-unmatched', [3, 4]),
      );
      assert.throws(
        () => RoutePattern.parse('https://(:sub.remix.run/products/:id'),
        //                        01234567^
        new ParseError('paren-unmatched', [8, 9]),
      );
      assert.throws(
        () => RoutePattern.parse('https://:sub.remix.run/products(/:id'),
        //                        0123456789 123456789 123456789 ^
        new ParseError('paren-unmatched', [31, 32]),
      );
    });

    it('errors on nested parens', () => {
      assert.throws(
        () => RoutePattern.parse('htt(p(s://:sub.remix.run/products/:id'),
        //                        01234^
        new ParseError('paren-nested', [5, 6]),
      );
      assert.throws(
        () => RoutePattern.parse('https://(:sub.(remix.run/products/:id'),
        //                        0123456789 123^
        new ParseError('paren-nested', [14, 15]),
      );
      assert.throws(
        () => RoutePattern.parse('https://:sub.remix.run/(products(/:id'),
        //                        0123456789 123456789 123456789 1^
        new ParseError('paren-nested', [32, 33]),
      );
    });

    it('errors on params in protocol', () => {
      assert.throws(
        () => RoutePattern.parse('http:s://:sub.remix.run'),
        //                        0123^^
        new ParseError('param-in-protocol', [4, 6]),
      );
    });
    it('errors on missing param names', () => {
      assert.throws(
        () => RoutePattern.parse('https://:.remix.run'),
        //                        01234567^
        new ParseError('param-missing-name', [8, 9]),
      );
      assert.throws(
        () => RoutePattern.parse('https://remix.run/blog/:/edit'),
        //                        0123456789 123456789 12^
        new ParseError('param-missing-name', [23, 24]),
      );
    });

    it('errors on globs in protocol', () => {
      assert.throws(
        () => RoutePattern.parse('http*s://:sub.remix.run'),
        //                        0123^^
        new ParseError('glob-in-protocol', [4, 6]),
      );
    });
    it('errors on missing glob names', () => {
      assert.throws(
        () => RoutePattern.parse('https://*.remix.run'),
        //                        01234567^
        new ParseError('glob-missing-name', [8, 9]),
      );
      assert.throws(
        () => RoutePattern.parse('https://remix.run/blog/*'),
        //                        0123456789 123456789 12^
        new ParseError('glob-missing-name', [23, 24]),
      );
    });
    it('errors on glob in hostname if not at start of hostname', () => {
      assert.throws(
        () => RoutePattern.parse('https://www.*website.com'),
        //                        0123456789 1^^^^^^^^
        new ParseError('glob-not-at-start-of-hostname', [12, 20]),
      );
      assert.throws(
        () => RoutePattern.parse('https://(www.*website).com'),
        //                        0123456789 12^^^^^^^^
        new ParseError('glob-not-at-start-of-hostname', [13, 21]),
      );
    });
    it('errors on glob in pathname if not at end of pathname', () => {
      assert.throws(
        () => RoutePattern.parse('https://remix.run/blog/*slug/edit'),
        //                        0123456789 123456789 12^^^^^
        new ParseError('glob-not-at-end-of-pathname', [23, 28]),
      );
      assert.throws(
        () => RoutePattern.parse('https://remix.run/blog(/*slug/edit)'),
        //                        0123456789 123456789 123^^^^^
        new ParseError('glob-not-at-end-of-pathname', [24, 29]),
      );
    });
  });

  describe('source', () => {
    const source = 'http(s)://(:sub).remix.run/products/:id(/v:version)/*rest';
    assert.deepStrictEqual(RoutePattern.parse(source).source, source);
  });

  describe('join', () => {
    const cases: Array<{ pattern1: string; pattern2: string; expected: string }> = [
      {
        pattern1: 'products/:id',
        pattern2: 'users/:username',
        expected: 'products/:id/users/:username',
      },
      {
        pattern1: 'products/:id',
        pattern2: '://remix.run',
        expected: '://remix.run/products/:id',
      },
      {
        pattern1: 'products/:id',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/products/:id/users/:username',
      },
      {
        pattern1: 'products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
      {
        pattern1: '://unpkg.com',
        pattern2: 'users/:username',
        expected: '://unpkg.com/users/:username',
      },
      {
        pattern1: '://unpkg.com',
        pattern2: '://remix.run',
        expected: '://remix.run',
      },
      {
        pattern1: '://unpkg.com',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/users/:username',
      },
      {
        pattern1: '://unpkg.com',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/users/:username',
      },
      {
        pattern1: '://unpkg.com/products/:id',
        pattern2: 'users/:username',
        expected: '://unpkg.com/products/:id/users/:username',
      },
      {
        pattern1: '://unpkg.com/products/:id',
        pattern2: '://remix.run',
        expected: '://remix.run/products/:id',
      },
      {
        pattern1: '://unpkg.com/products/:id',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/products/:id/users/:username',
      },
      {
        pattern1: '://unpkg.com/products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
      {
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: 'users/:username',
        expected: 'https://unpkg.com/products/:id/users/:username',
      },
      {
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: '://remix.run',
        expected: 'https://remix.run/products/:id',
      },
      {
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: '://remix.run/users/:username',
        expected: 'https://remix.run/products/:id/users/:username',
      },
      {
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
    ];
    for (const { pattern1, pattern2, expected } of cases) {
      const p1 = RoutePattern.parse(pattern1);
      const p2 = RoutePattern.parse(pattern2);
      const p3 = p1.join(p2);
      assert.deepStrictEqual(p3.source, expected);
    }
  });
});
