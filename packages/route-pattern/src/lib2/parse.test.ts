import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse, type AST, type ParseError } from './parse.ts';

describe('parse', () => {
  it('protocol + hostname', () => {
    const result = parse('https://remix.run');
    if (!result.ok) assert.fail(result.error.type);
    assert.deepStrictEqual(result.value, {
      protocol: [{ type: 'text', text: 'https', span: [0, 5] }],
      hostname: [{ type: 'text', text: 'remix.run', span: [0, 9] }],
    });
  });

  it('pathname + search', () => {
    const result = parse('products/1?color=block');
    if (!result.ok) assert.fail(result.error.type);
    assert.deepStrictEqual(result.value, {
      pathname: [{ type: 'text', text: 'products/1', span: [0, 10] }],
      search: [{ type: 'text', text: 'color=block', span: [0, 11] }],
    });
  });

  it('protocol + hostname + pathname + search', () => {
    const result = parse('https://remix.run/products/1?color=black');
    if (!result.ok) assert.fail(result.error.type);
    assert.deepEqual(result.value, {
      protocol: [{ type: 'text', text: 'https', span: [0, 5] }],
      hostname: [{ type: 'text', text: 'remix.run', span: [0, 9] }],
      pathname: [{ type: 'text', text: 'products/1', span: [0, 10] }],
      search: [{ type: 'text', text: 'color=black', span: [0, 11] }],
    });
  });

  it('protocol + hostname + pathname + search with optionals', () => {
    const result = parse('http(s)://remix.run/products/:id?color=black');
    if (!result.ok) assert.fail(result.error.type);
    assert.deepStrictEqual(result.value, {
      protocol: [
        { type: 'text', text: 'http', span: [0, 4] },
        { type: 'optional', option: [{ type: 'text', text: 's', span: [5, 6] }], span: [4, 7] },
      ],
      hostname: [{ type: 'text', text: 'remix.run', span: [0, 9] }],
      pathname: [
        { type: 'text', text: 'products/', span: [0, 9] },
        { type: 'param', name: 'id', span: [9, 12] },
      ],
      search: [{ type: 'text', text: 'color=black', span: [0, 11] }],
    });
  });

  it('errors on unbalanced parens', () => {
    const cases: Record<string, [string, ParseError]> = {
      'protocol-(': ['http(s://www.remix.run/products/:id', { type: 'unmatched-paren', index: 4 }],
      'protocol-)': ['https)://www.remix.run/products/:id', { type: 'unmatched-paren', index: 5 }],
      'hostname-(': ['https://www.(remix.run/products/:id', { type: 'unmatched-paren', index: 4 }],
      'hostname-)': ['https://www.re)mix.run/products/:id', { type: 'unmatched-paren', index: 6 }],
      'pathname-(': ['https://www.remix.run/products(/:id', { type: 'unmatched-paren', index: 8 }],
      'pathname-)': ['https://www.remix.run/products/:id)', { type: 'unmatched-paren', index: 12 }],

      // parens must be balanced _within_ each part
      'protocol+hostname': [
        'http(s://www.re)mix.run/products/:id',
        { type: 'unmatched-paren', index: 4 },
      ],
      'hostname+pathname': [
        'https://www.re(mix.run/products/:id)',
        { type: 'unmatched-paren', index: 6 },
      ],
      'protocol+pathname': [
        'http(s://www.remix.run/products/:id)',
        { type: 'unmatched-paren', index: 4 },
      ],
    };
    for (const [name, [input, expected]] of Object.entries(cases)) {
      const result = parse(input);
      if (result.ok) assert.fail('expected error');
      assert.deepStrictEqual(result.error, expected);
    }
  });

  it('errors on `?`, `/`, or `:` in protocol', () => {
    const cases: Record<string, [string, ParseError]> = {
      '?': ['htt?ps://remix.run', { type: 'unrecognized', index: 3 }],
      '/': ['htt/ps://remix.run', { type: 'unrecognized', index: 3 }],
      ':': ['htt:ps://remix.run', { type: 'unrecognized', index: 3 }],
    };
    for (const [name, [input, expected]] of Object.entries(cases)) {
      const result = parse(input);
      if (result.ok) assert.fail('expected error');
      assert.deepStrictEqual(result.error, expected);
    }
  });

  it('errors on missing param name', () => {
    const cases: Record<string, [string, ParseError]> = {
      'hostname:optional': [
        'https://www.(re:)mix.run/products/:id',
        { type: 'missing-param-name', index: 7 },
      ],
      'hostname:non-optional': [
        'https://www.re:1mix.run/products/:id',
        { type: 'missing-param-name', index: 6 },
      ],
      'pathname:optional': [
        'https://www.remix.run/(products-:)/:id',
        { type: 'missing-param-name', index: 10 },
      ],
      'pathname:non-optional': [
        'https://www.remix.run/products-:1/:id',
        { type: 'missing-param-name', index: 9 },
      ],
    };
    for (const [name, [input, expected]] of Object.entries(cases)) {
      const result = parse(input);
      if (result.ok) assert.fail('expected error');
      assert.deepStrictEqual(result.error, expected);
    }
  });

  it('parses params', () => {
    const cases: Record<string, [string, AST]> = {
      hostname: [
        'https://:sub(.re:mix).run',
        {
          protocol: [
            {
              span: [0, 5],
              text: 'https',
              type: 'text',
            },
          ],
          hostname: [
            {
              name: 'sub',
              span: [0, 4],
              type: 'param',
            },
            {
              option: [
                {
                  span: [5, 8],
                  text: '.re',
                  type: 'text',
                },
                {
                  name: 'mix',
                  span: [8, 12],
                  type: 'param',
                },
              ],
              span: [4, 13],
              type: 'optional',
            },
            {
              span: [13, 17],
              text: '.run',
              type: 'text',
            },
          ],
        },
      ],
      pathname: [
        'https://remix.run/products(/:id)/:view',
        {
          protocol: [
            {
              span: [0, 5],
              text: 'https',
              type: 'text',
            },
          ],
          hostname: [
            {
              span: [0, 9],
              text: 'remix.run',
              type: 'text',
            },
          ],
          pathname: [
            {
              span: [0, 8],
              text: 'products',
              type: 'text',
            },
            {
              option: [
                {
                  span: [9, 10],
                  text: '/',
                  type: 'text',
                },
                {
                  name: 'id',
                  span: [10, 13],
                  type: 'param',
                },
              ],
              span: [8, 14],
              type: 'optional',
            },
            {
              span: [14, 15],
              text: '/',
              type: 'text',
            },
            {
              name: 'view',
              span: [15, 20],
              type: 'param',
            },
          ],
        },
      ],
    };
    for (const [name, [input, expected]] of Object.entries(cases)) {
      const result = parse(input);
      if (!result.ok) assert.fail(result.error.type);
      assert.deepStrictEqual(result.value, expected);
    }
  });
});
