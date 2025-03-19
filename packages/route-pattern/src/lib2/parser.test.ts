import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse } from './parser.ts';

// invalid?
// pathname only
// pathname + search param
//

describe('parse', () => {
  it('protocol + hostname', () => {
    const result = parse('https://remix.run');
    if (!result.ok) assert.fail(JSON.stringify(result.error));
    assert.deepEqual(result.value, {
      protocol: [{ type: 'text', value: 'https' }],
      hostname: [{ type: 'text', value: 'remix.run' }],
    });
  });

  it('pathname + search', () => {
    const result = parse('products/1?color=block');
    if (!result.ok) assert.fail(JSON.stringify(result.error));
    assert.deepEqual(result.value, {
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=block' },
    });
  });

  it('protocol + hostname + pathname + search', () => {
    const result = parse('https://remix.run/products/1?color=black');
    if (!result.ok) assert.fail(JSON.stringify(result.error));
    assert.deepEqual(result.value, {
      protocol: [{ type: 'text', value: 'https' }],
      hostname: [{ type: 'text', value: 'remix.run' }],
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=black' },
    });
  });

  it('protocol + hostname + pathname + search with optionals', () => {
    const result = parse('http(s)://remix.run/products/:id?color=black');
    if (!result.ok) assert.fail(JSON.stringify(result.error));
    assert.deepEqual(result.value, {
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
});
