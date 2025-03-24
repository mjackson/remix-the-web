import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse } from './lex3.ts';

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

  it('errors on unbalanced parens in each part', () => {
    const cases = {
      'protocol-(': ['http(s://www.remix.run/products/:id'],
      'protocol-)': ['https)://www.remix.run/products/:id'],
      'hostname-(': ['https://www.(remix.run/products/:id'],
      'hostname-)': ['https://www.re)mix.run/products/:id'],
      'pathname-(': ['https://www.remix.run/products(/:id'],
      'pathname-)': ['https://www.remix.run/products/:id)'],
    };
    // 'http(s://www.re)mix.run/products/:id';
    // 'https://www.re(mix.run/products/:id)';
    // 'http(s://www.remix.run/products/:id)';
  });

  // - [ ] protocol: no `?`, `/`, `:` chars allowed
  // htt?ps://www.remix.run
  // htt/ps://www.remix.run
  // htt:ps://www.remix.run
  //
  // // - [ ] hostname + pathname: no `:` without param
  // hostname:
  // https://www.(re:)mix.run/products/:id
  // https://www.re:1mix.run/products/:id
  // pathname:
  // https://www.remix.run/(products-:)/:id
  // https://www.remix.run/products-:1/:id
  //
  // - [ ]  params: hostname/pathname, in/out of optional
  //
  it('errs on mismatched parens in protocol', () => {
    const result = parse('http(s://www.remix.run/products/:id?q=1');
    if (result.ok) assert.fail('expected error');
    assert.deepStrictEqual(result.error, { type: 'unmatched-paren', index: 4 });
  });

  it('errs on mismatched parens in hostname', () => {
    const result = parse('http(s://www.remix.run/products/:id?q=1');
    if (result.ok) assert.fail('expected error');
    assert.deepStrictEqual(result.error, { type: 'unmatched-paren', index: 4 });
  });
});
