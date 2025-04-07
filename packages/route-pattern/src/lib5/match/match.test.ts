import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { createTree } from './tree2.ts';
import { parse } from '../parse.ts';
import { match, type _URL } from './match4.ts';

// benchmark
// repeated params
// backtracks

describe('match', () => {
  it('backtracks', () => {
    const tree = createTree([
      parse('http://remix.run/a/b/c/d/e'),
      parse('http://remix.run/a/b/c/:d/e'),
      parse('http://remix.run/a/b/:c/d/e'),
      parse('http://remix.run/a/:b/c/d/e'),
      parse('http://remix.run/:a/b/c/d/e'),
      parse('http://remix.run/:a/:b/:c/:d/:e'),
    ]);

    const routes = match(tree, 'http://remix.run/a/b/c/d/z');
    const route = routes.next();
    assert.deepStrictEqual(route, {});
  });

  it('works', () => {
    const tree = createTree([
      parse('http(s)://(:sub.)remix.run/products/:id(/v:version)'),
      parse('http://react-router.com/blog/:slug'),
    ]);

    const start = performance.now();
    const routes = match(tree, 'http://remix.run/products/1/v7');
    const route = routes.next();
    console.log(`Match took ${performance.now() - start}ms`);

    assert.deepStrictEqual(route, {});
  });
});
