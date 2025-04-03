import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse } from '../parse.ts';
import { variants } from './variants.ts';

describe('variants', () => {
  it('works', () => {
    const pattern = parse('http(s)://(:sub.)remix.run/products/:id(/v:version)');
    const actual = Array.from(variants(pattern));
    assert.deepStrictEqual(actual, [
      {
        protocol: 'http',
        hostname: ['run', 'remix'],
        pathname: ['products', ':'],
        search: '',
        paramSlots: [
          ['sub', false],
          ['id', true],
          ['version', false],
        ],
      },
      {
        protocol: 'https',
        hostname: ['run', 'remix'],
        pathname: ['products', ':'],
        search: '',
        paramSlots: [
          ['sub', false],
          ['id', true],
          ['version', false],
        ],
      },
      {
        protocol: 'http',
        hostname: ['run', 'remix', ':'],
        pathname: ['products', ':'],
        search: '',
        paramSlots: [
          ['sub', true],
          ['id', true],
          ['version', false],
        ],
      },
      {
        protocol: 'https',
        hostname: ['run', 'remix', ':'],
        pathname: ['products', ':'],
        search: '',
        paramSlots: [
          ['sub', true],
          ['id', true],
          ['version', false],
        ],
      },
      {
        protocol: 'http',
        hostname: ['run', 'remix'],
        pathname: ['products', ':', 'v:'],
        search: '',
        paramSlots: [
          ['sub', false],
          ['id', true],
          ['version', true],
        ],
      },
      {
        protocol: 'https',
        hostname: ['run', 'remix'],
        pathname: ['products', ':', 'v:'],
        search: '',
        paramSlots: [
          ['sub', false],
          ['id', true],
          ['version', true],
        ],
      },
      {
        protocol: 'http',
        hostname: ['run', 'remix', ':'],
        pathname: ['products', ':', 'v:'],
        search: '',
        paramSlots: [
          ['sub', true],
          ['id', true],
          ['version', true],
        ],
      },
      {
        protocol: 'https',
        hostname: ['run', 'remix', ':'],
        pathname: ['products', ':', 'v:'],
        search: '',
        paramSlots: [
          ['sub', true],
          ['id', true],
          ['version', true],
        ],
      },
    ]);
  });
});
