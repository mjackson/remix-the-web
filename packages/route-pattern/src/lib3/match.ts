/*
tree that has protocol -> hostname -> pathname
 */

import type { RoutePattern } from './route-pattern';

export type Node = {
  type: 'root' | 'protocol' | 'hostname' | 'pathname';
  staticChildren: Map<string, Node>;
  dynamicChildren: Array<[RegExp, Node]>;
  glob?: Node; // `*`
  end?: Node; // transition to next part
};

const createNode = (type: Node['type']): Node => {
  return { type, staticChildren: new Map(), dynamicChildren: [] };
};

type ProtocolNode = {
  type: 'protocol';
  staticChildren: Map<string, HostnameNode>;
  glob?: HostnameNode;
};

type HostnameNode = {
  type: 'hostname';
  staticChildren: Map<string, HostnameNode | PathnameNode>;
  dynamicChildren: Array<[RegExp, HostnameNode | PathnameNode]>;
  // glob
};

type PathnameNode = {
  type: 'pathname';
  staticChildren: Map<string, HostnameNode | PathnameNode>;
  dynamicChildren: Array<[RegExp, HostnameNode | PathnameNode]>;
  // glob
};

function fromPatterns(patterns: Array<RoutePattern>): Node {
  const root: Node = createNode('protocol');

  let node = root;
  for (const pattern of patterns) {
    const variant = ''; // TODO loop over variants
    const parts = split(variant);
    if (parts.protocol) {
      let next = node.staticChildren.get(parts.protocol);
      if (!next) {
        next = createNode('hostname');
        node.staticChildren.set(parts.protocol, next);
      }
      node = next;
    } else {
      if (!node.glob) {
        node.glob = createNode('hostname');
      }
      let next = node.glob;
    }
  }
  return root;
}

declare const split: (variant: string) => {
  protocol?: string;
  hostname?: string;
  pathname?: string;
};
