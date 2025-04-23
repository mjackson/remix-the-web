import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { split } from './split.ts';

describe('split', () => {
  it('splits the pattern into protocol, hostname, pathname, and search', () => {
    const cases: Array<[string, ReturnType<typeof split>]> = [
      ['products/:id', { pathname: 'products/:id' }],
      ['https://remix.run', { protocol: 'https', hostname: 'remix.run' }],
      ['products/:id?q=1', { pathname: 'products/:id', search: 'q=1' }],
      [
        'https://remix.run/products/:id?q=1',
        { protocol: 'https', hostname: 'remix.run', pathname: 'products/:id', search: 'q=1' },
      ],
      ['://remix.run', { hostname: 'remix.run' }],
    ];
    for (let [input, expected] of cases) {
      const actual = split(input);
      assert.deepEqual(actual, expected);
    }
  });
});
