import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse, ParseError } from './parser.ts';

describe('parse', () => {
  it('protocol + hostname', () => {
    const result = parse('https://remix.run');
    assert.deepEqual(result, {
      protocol: [{ type: 'text', value: 'https' }],
      hostname: [{ type: 'text', value: 'remix.run' }],
    });
  });

  it('pathname + search', () => {
    const result = parse('products/1?color=block');
    assert.deepEqual(result, {
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=block' },
    });
  });

  it('protocol + hostname + pathname + search', () => {
    const result = parse('https://remix.run/products/1?color=black');
    assert.deepEqual(result, {
      protocol: [{ type: 'text', value: 'https' }],
      hostname: [{ type: 'text', value: 'remix.run' }],
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=black' },
    });
  });

  it('protocol + hostname + pathname + search with optionals', () => {
    const result = parse('http(s)://remix.run/products/:id?color=black');
    assert.deepEqual(result, {
      protocol: [
        { type: 'text', value: 'http' },
        { type: 'optional', value: [{ type: 'text', value: 's' }] },
      ],
      hostname: [{ type: 'text', value: 'remix.run' }],
      pathname: [
        { type: 'text', value: 'products/' },
        { type: 'param', name: 'id' },
      ],
      search: { type: 'text', value: 'color=black' },
    });
  });

  // - [ ] unbalanced params in each part
  // - [ ] unbalanced within parts even when balanced as a whole
  // - [ ] protocol: no `?`, `/`, `:` chars allowed
  // - [ ] hostname + pathname: no `:` without param

  // it('errs on mismatched parens', () => {
  //   const source = 'http(s://(www.remix.run/products(/:id?q=1';
  //   assert.throws(
  //     () => parse(source),
  //     new ParseError('Unmatched parenthesis', { source, index: 4 }),
  //   );
  // });
});
