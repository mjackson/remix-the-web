import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { split, type Split } from './split.ts';

const cases: Record<string, [string, Split]> = {
  pathname: ['products/:id', { pathname: 'products/:id' }],
  'protocol+hostname': ['https://remix.run', { protocol: 'https', hostname: 'remix.run' }],
  'pathname+search': ['products/:id?q=1', { pathname: 'products/:id', search: 'q=1' }],
  'procotol+hostname+pathname+search': [
    'https://remix.run/products/:id?q=1',
    { protocol: 'https', hostname: 'remix.run', pathname: 'products/:id', search: 'q=1' },
  ],
  hostname: ['://remix.run', { hostname: 'remix.run' }],
};

describe('split', () => {
  for (let [name, [input, expected]] of Object.entries(cases)) {
    it(name, () => {
      const actual = split(input);
      assert.deepEqual(actual, expected);
    });
  }
});
