import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { parse } from './parse.ts';
import { getParamNames } from './params.ts';

describe('params', () => {
  it('works', () => {
    const result = parse('https://(:sub).remix.run/(:lang/)foo/(:bar/:lang)/:baz');
    if (!result.ok) assert.fail(result.error.type);
    const paramNames = getParamNames(result.value);
    assert.deepStrictEqual(paramNames, []);
  });
});
