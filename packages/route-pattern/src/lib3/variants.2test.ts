import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse } from './parse.ts';
import { getVariants, segments } from './variants.ts';

describe('variants', () => {
  it('works', () => {
    const result = parse('http(s)://(:sub.)remix.run/(:lang/)products/:id');
    if (!result.ok) assert.fail(result.error.type);
    const ast = result.value;
    const variants = Array.from(getVariants(ast));
    const x = variants.map((variant) => {
      const s = segments(variant);
      return s.protocol.join('') + '://' + s.hostname.join('.') + '/' + s.pathname.join('/');
    });
    assert.deepStrictEqual(x, []);
  });
});
