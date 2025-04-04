import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { createTree, type Node } from './tree2.ts';
import { parse } from '../parse.ts';
import { match, type _URL } from './match4.ts';

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
    // console.log({ route });
    assert.deepStrictEqual(route, {});
  });

  it('works', () => {
    const tree = createTree([
      parse('http(s)://(:sub.)remix.run/products/:id(/v:version)'),
      parse('http://react-router.com/blog/:slug'),
    ]);

    stringify('protocol', tree.protocol); // debug: console log the tree structure

    const start = performance.now();
    const routes = match(tree, 'http://remix.run/products/1/v7');
    const route = routes.next();
    console.log(`Match took ${performance.now() - start}ms`);

    assert.deepStrictEqual(route, {});
  });
});

type Children = {
  static: Map<string, Node>;
  dynamic: Map<string, Node>;
  dynamicOrder: Array<[string, RegExp]>;
};
function stringify(type: string, children: Children, indent = 0) {
  const tab = '  '.repeat(indent);

  for (const [key, child] of children.static) {
    console.log(tab + `${type}(${key})`);
    stringify('protocol', child.protocol, indent + 1);
    stringify('hostname', child.hostname, indent + 1);
    stringify('pathname', child.pathname, indent + 1);
  }
  for (const [key, child] of children.dynamic) {
    console.log(tab + `${type}(${key})`);
    stringify('protocol', child.protocol, indent + 1);
    stringify('hostname', child.hostname, indent + 1);
    stringify('pathname', child.pathname, indent + 1);
  }
}
