import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { pattern } from './parser.ts';

// invalid?
// pathname only
// pathname + search param
//

describe('parse', () => {
  // it('protocol + hostname', () => {
  //   const result = pattern.parse({ source: 'https://remix.run', index: 0 });
  //   if (!result.ok) assert.fail();
  //   assert.deepEqual(result.value.data, {
  //     protocol: [{ type: 'text', value: 'https' }],
  //     hostname: [{ type: 'text', value: 'remix.run' }],
  //   });
  // });

  it('pathname + search', () => {
    const result = pattern.parse({ source: 'products/1?color=block', index: 0 });
    if (!result.ok) assert.fail();
    assert.deepEqual(result.value.data, {
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=block' },
    });
  });

  it('protocol + hostname + pathname + search', () => {
    const result = pattern.parse({ source: 'https://remix.run/products/1?color=black', index: 0 });
    if (!result.ok) assert.fail();
    assert.deepEqual(result.value.data, {
      protocol: [{ type: 'text', value: 'https' }],
      hostname: [{ type: 'text', value: 'remix.run' }],
      pathname: [{ type: 'text', value: 'products/1' }],
      search: { type: 'text', value: 'color=black' },
    });
  });

  it('protocol + hostname + pathname + search with optionals', () => {
    const result = pattern.parse({
      source: 'http(s)://remix.run/products/:id?color=black',
      index: 0,
    });
    if (!result.ok) assert.fail();
    assert.deepEqual(result.value.data, {
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
