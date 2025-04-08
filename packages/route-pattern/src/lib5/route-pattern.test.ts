import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { RoutePattern, ParseError } from './route-pattern.ts';

function testErrorCases(
  cases: Array<{
    name: string;
    source: string;
    expectedError: ParseError;
  }>,
) {
  for (const { name, source, expectedError } of cases) {
    it(name, () => {
      assert.throws(() => RoutePattern.parse(source), expectedError);
    });
  }
}

describe('RoutePattern', () => {
  describe('parse', () => {
    describe('errors on unmatched paren', () => {
      testErrorCases([
        {
          name: '`(` in protocol',
          source: 'http(s://www.remix.run/products/:id',
          //       0123^
          expectedError: new ParseError('unmatched-paren', 4),
        },
        {
          name: '`)` in protocol',
          source: 'https)://www.remix.run/products/:id',
          //       01234^
          expectedError: new ParseError('unmatched-paren', 5),
        },
        {
          name: '`(` in hostname',
          source: 'https://www.(remix.run/products/:id',
          //       0123456789 1^
          expectedError: new ParseError('unmatched-paren', 12),
        },
        {
          name: '`)` in hostname',
          source: 'https://www.re)mix.run/products/:id',
          //       0123456789 123^
          expectedError: new ParseError('unmatched-paren', 14),
        },
        {
          name: '`(` in pathname',
          source: 'https://www.remix.run/products(/:id',
          //       0123456789 123456789 123456789^
          expectedError: new ParseError('unmatched-paren', 30),
        },
        {
          name: '`)` in pathname',
          source: 'https://www.remix.run/products/:id)',
          //       0123456789 123456789 123456789 123^
          expectedError: new ParseError('unmatched-paren', 34),
        },
        {
          name: '`(` in protocol that visually matches `)` in hostname',
          source: 'http(s://www.re)mix.run/products/:id',
          //       0123^
          expectedError: new ParseError('unmatched-paren', 4),
        },
        {
          name: '`(` in hostname that visually matches `)` in pathname',
          source: 'https://www.re(mix.run/products/:id)',
          //       0123456789 123^
          expectedError: new ParseError('unmatched-paren', 14),
        },
        {
          name: '`(` in protocol that visually matches `)` in pathname',
          source: 'http(s://www.remix.run/products/:id)',
          //       0123^
          expectedError: new ParseError('unmatched-paren', 4),
        },
      ]);
    });

    describe('errors on nested paren', () => {
      testErrorCases([
        {
          name: 'in protocol',
          source: 'ht(tp(s)://www.remix.run/products/:id',
          //       01234^
          expectedError: new ParseError('nested-paren', 5),
        },
        {
          name: 'in hostname',
          source: 'https://(www(.remix).run/products/:id',
          //       0123456789 1^
          expectedError: new ParseError('nested-paren', 12),
        },
        {
          name: 'in pathname',
          source: 'https://www.remix.run/product(s/(:id)',
          //       0123456789 123456789 123456789 1^
          expectedError: new ParseError('nested-paren', 32),
        },
      ]);
    });

    describe('errors on missing param name', () => {
      testErrorCases([
        {
          name: 'in hostname (outside optional)',
          source: 'https://www.re:1mix.run/products/:id',
          //       0123456789 123^
          expectedError: new ParseError('missing-param-name', 14),
        },
        {
          name: 'in hostname (inside optional)',
          source: 'https://www.(re:)mix.run/products/:id',
          //       0123456789 1234^
          expectedError: new ParseError('missing-param-name', 15),
        },
        {
          name: 'in pathname (outside optional)',
          source: 'https://www.remix.run/products-:1/:id',
          //       0123456789 123456789 123456789 ^
          expectedError: new ParseError('missing-param-name', 31),
        },
        {
          name: 'in pathname (inside optional)',
          source: 'https://www.remix.run/(products-:)/:id',
          //       0123456789 123456789 0123456789 1^
          expectedError: new ParseError('missing-param-name', 32),
        },
      ]);
    });
  });

  describe('source', () => {
    describe('matches input', () => {
      const patterns = [
        'products/:id',
        '://remix.run/products/:id',
        'http://remix.run/products/:id',
        'http(s)://(:sub.)remix.run/products/:id(/v:version)?q',
      ];
      for (const pattern of patterns) {
        it(pattern, () => {
          const routePattern = RoutePattern.parse(pattern);
          assert.deepStrictEqual(routePattern.source, pattern);
        });
      }
    });
  });

  describe('join', () => {
    const cases = [
      {
        name: 'path x path',
        pattern1: 'products/:id',
        pattern2: 'users/:username',
        expected: 'products/:id/users/:username',
      },
      {
        name: 'path x host',
        pattern1: 'products/:id',
        pattern2: '://remix.run',
        expected: '://remix.run/products/:id',
      },
      {
        name: 'path x host+path',
        pattern1: 'products/:id',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/products/:id/users/:username',
      },
      {
        name: 'path x full',
        pattern1: 'products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
      {
        name: 'host x path',
        pattern1: '://unpkg.com',
        pattern2: 'users/:username',
        expected: '://unpkg.com/users/:username',
      },
      {
        name: 'host x host',
        pattern1: '://unpkg.com',
        pattern2: '://remix.run',
        expected: '://remix.run',
      },
      {
        name: 'host x host+path',
        pattern1: '://unpkg.com',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/users/:username',
      },
      {
        name: 'host x full',
        pattern1: '://unpkg.com',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/users/:username',
      },
      {
        name: 'host+path x path',
        pattern1: '://unpkg.com/products/:id',
        pattern2: 'users/:username',
        expected: '://unpkg.com/products/:id/users/:username',
      },
      {
        name: 'host+path x host',
        pattern1: '://unpkg.com/products/:id',
        pattern2: '://remix.run',
        expected: '://remix.run/products/:id',
      },
      {
        name: 'host+path x host+path',
        pattern1: '://unpkg.com/products/:id',
        pattern2: '://remix.run/users/:username',
        expected: '://remix.run/products/:id/users/:username',
      },
      {
        name: 'host+path x full',
        pattern1: '://unpkg.com/products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
      {
        name: 'full x path',
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: 'users/:username',
        expected: 'https://unpkg.com/products/:id/users/:username',
      },
      {
        name: 'full x host',
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: '://remix.run',
        expected: 'https://remix.run/products/:id',
      },
      {
        name: 'full x host+path',
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: '://remix.run/users/:username',
        expected: 'https://remix.run/products/:id/users/:username',
      },
      {
        name: 'full x full',
        pattern1: 'https://unpkg.com/products/:id',
        pattern2: 'http://remix.run/users/:username',
        expected: 'http://remix.run/products/:id/users/:username',
      },
    ];
    for (const { name, pattern1, pattern2, expected } of cases) {
      it(name, () => {
        const p1 = RoutePattern.parse(pattern1);
        const p2 = RoutePattern.parse(pattern2);
        const p3 = p1.join(p2);
        assert.deepStrictEqual(p3.source, expected);
      });
    }
  });
});
