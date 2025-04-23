import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { sortByStaticLengths } from './sort-by-static-lengths.ts';

describe('sortByStaticLengths', () => {
  it('sorts correctly', () => {
    const dynamics = ['a-:', 'a-:-b', ':-b', 'a-:-:-b', 'hello-:-world', 'hello-:', ':-world'];
    dynamics.sort(sortByStaticLengths);
    assert.deepStrictEqual(dynamics, [
      'hello-:-world',
      'hello-:',
      'a-:-b',
      'a-:-:-b',
      'a-:',
      ':-world',
      ':-b',
    ]);
  });
});
