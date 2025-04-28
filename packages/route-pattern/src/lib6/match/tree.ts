import type { RoutePattern, RouteVariant } from '../route-pattern.ts';
import { sortByStaticLengths } from '../utils/sort-by-static-lengths.ts';

export type Node = {
  protocol: Children;
  hostname: Children;
  pathname: Children;

  route?: Route;
};

// glob as Map / RegExp array?
type Children = {
  static: Map<string, Node>;
  dynamic: Map<string, Node>;
  dynamicOrder: Array<[string, RegExp]>;
  glob?: Node;
};

type Route = {
  pattern: RoutePattern;
  variant: RouteVariant;
};

export class RouteConflictError extends Error {
  existing: Route;
  conflicting: Route;

  constructor(existing: Route, conflicting: Route) {
    super();
    this.existing = existing;
    this.conflicting = conflicting;
  }

  // todo nice error message
}

function createNode(): Node {
  return {
    protocol: createChildren(),
    hostname: createChildren(),
    pathname: createChildren(),
  };
}

function createChildren(): Children {
  return {
    static: new Map(),
    dynamic: new Map(),
    dynamicOrder: [],
  };
}

function insertSegments(
  node: Node,
  type: 'protocol' | 'hostname' | 'pathname',
  segments: Array<string>,
  onDynamic?: (children: Children) => void,
): Node {
  for (const segment of segments) {
    const isDynamic = segment.includes(':');
    const children = isDynamic ? node[type].dynamic : node[type].static;
    let child = children.get(segment);
    if (!child) {
      child = createNode();
      children.set(segment, child);
      if (isDynamic) onDynamic?.(node[type]);
    }
    node = child;
  }
  // todo glob in hostname
  return node;
}

const paramValueRE = /(.+)/;
const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createTree(patterns: Array<RoutePattern>): Node {
  const root = createNode();
  const dynamic = new Set<Children>();

  for (const pattern of patterns) {
    for (const variant of pattern.variants()) {
      let node = root;

      if (variant.protocol) {
        const segments = [variant.protocol];
        node = insertSegments(node, 'protocol', segments);
      } else {
        // omitted protocol means any protocol will do
        let child = node.protocol.glob;
        if (!child) {
          child = createNode();
          node.protocol.glob = child;
        }
        node = child;
      }

      // hostname
      if (variant.hostname) {
        const segments = variant.hostname.source.split('.').reverse();
        node = insertSegments(node, 'hostname', segments, dynamic.add);
      } else {
        // omitted hostname means any hostname will do
        let child = node.protocol.glob;
        if (!child) {
          child = createNode();
          node.protocol.glob = child;
        }
        node = child;
      }

      // pathname
      if (variant.pathname) {
        const segments = variant.pathname.source.split('/');
        node = insertSegments(node, 'pathname', segments, dynamic.add);
      }

      if (node.route) {
        throw new RouteConflictError(node.route, { pattern, variant });
      }
      node.route = { pattern, variant };
    }
  }

  for (const children of dynamic) {
    const dynamicOrder: Array<[string, RegExp]> = [];
    for (const segment of children.dynamic.keys()) {
      const regex = new RegExp('^' + escape(segment).replaceAll(':', paramValueRE.source) + '$');
      dynamicOrder.push([segment, regex]);
    }
    dynamicOrder.sort((a, b) => sortByStaticLengths(a[0], b[0]));
    children.dynamicOrder = dynamicOrder;
  }

  return root;
}
