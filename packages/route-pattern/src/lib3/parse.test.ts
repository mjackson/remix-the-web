import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse, type ParseError } from './parse.ts';

function testErrorCases(
  cases: Array<{
    name: string;
    source: string;
    expectedError: ParseError;
  }>,
) {
  for (const { name, source, expectedError } of cases) {
    it(name, () => {
      const result = parse(source);
      if (result.ok) assert.fail(`Expected error: ${expectedError.type}`);
      assert.deepStrictEqual(result.error, expectedError);
    });
  }
}

describe('errors on unmatched paren', () => {
  testErrorCases([
    {
      name: '`(` in protocol',
      source: 'http(s://www.remix.run/products/:id',
      //       0123^
      expectedError: { type: 'unmatched-paren', index: 4 },
    },
    {
      name: '`)` in protocol',
      source: 'https)://www.remix.run/products/:id',
      //       01234^
      expectedError: { type: 'unmatched-paren', index: 5 },
    },
    {
      name: '`(` in hostname',
      source: 'https://www.(remix.run/products/:id',
      //       0123456789 1^
      expectedError: { type: 'unmatched-paren', index: 12 },
    },
    {
      name: '`)` in hostname',
      source: 'https://www.re)mix.run/products/:id',
      //       0123456789 123^
      expectedError: { type: 'unmatched-paren', index: 14 },
    },
    {
      name: '`(` in pathname',
      source: 'https://www.remix.run/products(/:id',
      //       0123456789 123456789 123456789^
      expectedError: { type: 'unmatched-paren', index: 30 },
    },
    {
      name: '`)` in pathname',
      source: 'https://www.remix.run/products/:id)',
      //       0123456789 123456789 123456789 123^
      expectedError: { type: 'unmatched-paren', index: 34 },
    },
    {
      name: '`(` in protocol that visually matches `)` in hostname',
      source: 'http(s://www.re)mix.run/products/:id',
      //       0123^
      expectedError: { type: 'unmatched-paren', index: 4 },
    },
    {
      name: '`(` in hostname that visually matches `)` in pathname',
      source: 'https://www.re(mix.run/products/:id)',
      //       0123456789 123^
      expectedError: { type: 'unmatched-paren', index: 14 },
    },
    {
      name: '`(` in protocol that visually matches `)` in pathname',
      source: 'http(s://www.remix.run/products/:id)',
      //       0123^
      expectedError: { type: 'unmatched-paren', index: 4 },
    },
  ]);
});

describe('errors on nested paren', () => {
  testErrorCases([
    {
      name: 'in protocol',
      source: 'ht(tp(s)://www.remix.run/products/:id',
      //       01234^
      expectedError: { type: 'nested-paren', index: 5 },
    },
    {
      name: 'in hostname',
      source: 'https://(www(.remix).run/products/:id',
      //       0123456789 1^
      expectedError: { type: 'nested-paren', index: 12 },
    },
    {
      name: 'in pathname',
      source: 'https://www.remix.run/product(s/(:id)',
      //       0123456789 123456789 123456789 1^
      expectedError: { type: 'nested-paren', index: 32 },
    },
  ]);
});

describe('errors on unrecognized characters in protocol', () => {
  testErrorCases([
    {
      name: '?',
      source: 'htt?ps://remix.run',
      //       012^
      expectedError: { type: 'unrecognized', index: 3 },
    },
    {
      name: '/',
      source: 'htt/ps://remix.run',
      //       012^
      expectedError: { type: 'unrecognized', index: 3 },
    },
    {
      name: ':',
      source: 'htt:ps://remix.run',
      //       012^
      expectedError: { type: 'unrecognized', index: 3 },
    },
  ]);
});

describe('errors on missing param name', () => {
  testErrorCases([
    {
      name: 'in hostname (outside optional)',
      source: 'https://www.re:1mix.run/products/:id',
      //       0123456789 123^
      expectedError: { type: 'missing-param-name', index: 14 },
    },
    {
      name: 'in hostname (inside optional)',
      source: 'https://www.(re:)mix.run/products/:id',
      //       0123456789 1234^
      expectedError: { type: 'missing-param-name', index: 15 },
    },
    {
      name: 'in pathname (outside optional)',
      source: 'https://www.remix.run/products-:1/:id',
      //       0123456789 123456789 123456789 ^
      expectedError: { type: 'missing-param-name', index: 31 },
    },
    {
      name: 'in pathname (inside optional)',
      source: 'https://www.remix.run/(products-:)/:id',
      //       0123456789 123456789 0123456789 1^
      expectedError: { type: 'missing-param-name', index: 32 },
    },
  ]);
});
