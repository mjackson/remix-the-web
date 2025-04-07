import type * as AST from './ast.ts';
/*
tree that has protocol -> hostname -> pathname
 */

import type { RoutePattern } from './route-pattern';

export type Node = {
  type: 'protocol' | 'hostname' | 'pathname';
  staticChildren: Map<string, Node>;
  dynamicChildren: Map<string, Node>;
  dynamicChildrenOrder: Array<[string, RegExp]>;
  glob?: Node; // `*`
  end?: Node; // transition to next part
};

const createNode = (type: Node['type']): Node => {
  return {
    type,
    staticChildren: new Map(),
    dynamicChildren: new Map(),
    dynamicChildrenOrder: [],
  };
};

type VariantPart = Array<Exclude<AST.Part[number], AST.Optional>>;
type Variant = {
  protocol: VariantPart;
  hostname: VariantPart;
  pathname: VariantPart;
};

function segments(vpart: VariantPart): Array<string> {
  const result: Array<string> = [];
  let segment = '';
  for (const item of vpart) {
    if (item.type === 'text') segment += item.text;
    if (item.type === 'param') segment += ':';
    if (item.type === 'separator') {
      result.push(segment);
      segment = '';
    }
  }
  if (segment.length > 0) {
    result.push(segment);
  }
  return result;
}

// phase 1: deduped
// phase 2: optimized

function fromPatterns(patterns: Array<RoutePattern>): Node {
  const root: Node = createNode('protocol');

  let node = root;
  for (const pattern of patterns) {
    const variant = {} as Variant;

    const p = segments(variant.protocol);

    // protocol
    if (variant.protocol.length > 0) {
      const protocol = variant.protocol
        .filter((item): item is AST.Text => item.type === 'text')
        .map((item) => item.text)
        .join('');
      let next = node.staticChildren.get(protocol);
      if (!next) {
        next = createNode('protocol');
        node.staticChildren.set(protocol, next);
      }
      node = next;
    } else {
      if (!node.glob) {
        node.glob = createNode('protocol');
      }
      node = node.glob;
    }

    // hostname
    let next = createNode('hostname');
    node.end = next;
    node = next;
    for (const segment of segments(variant.hostname)) {
      const isDynamic = segment.includes(':');

      const map = isDynamic ? node.dynamicChildren : node.staticChildren;
      let next = map.get(segment);
      if (!next) {
        next = createNode('hostname');
        map.set(segment, next);
        node = next;
      }
    }

    // pathname
    next = createNode('pathname');
    node.end = next;
    node = next;
    for (const segment of segments(variant.pathname)) {
      const isDynamic = segment.includes(':');

      const map = isDynamic ? node.dynamicChildren : node.staticChildren;
      let next = map.get(segment);
      if (!next) {
        next = createNode('pathname');
        map.set(segment, next);
        node = next;
      }
    }

    // node.route = ...
  }
  return root;
}
