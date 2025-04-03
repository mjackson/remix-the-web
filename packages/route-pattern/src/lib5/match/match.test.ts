import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { createTree, type Node } from './tree2.ts';
import { parse } from '../parse.ts';
import { match, type _URL } from './match4.ts';

describe('match', () => {
  it('works', () => {
    const patterns = [
      parse('http(s)://(:sub.)remix.run/products/:id(/v:version)'),
      parse('http://react-router.com/blog/:slug'),
    ];
    const tree = createTree(patterns);
    stringify('protocol', tree.protocol);
    const url: _URL = [
      { type: 'protocol', segment: 'http' },
      { type: 'hostname', segment: 'run' },
      { type: 'hostname', segment: 'remix' },
      { type: 'pathname', segment: 'products' },
      { type: 'pathname', segment: '1' },
      { type: 'pathname', segment: 'v7' },
    ];
    const routes = match(tree, url);
    const route = routes.next();
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
