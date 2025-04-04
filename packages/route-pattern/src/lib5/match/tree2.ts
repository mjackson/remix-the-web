import * as AST from '../ast.ts';
import { sortByStaticLengths } from './sort-by-static-lengths.ts';
import { variants, type Variant } from './variants.ts';

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

export type Node = {
  protocol: Children;
  hostname: Children;
  pathname: Children;

  route?: Route;
};

type Children = {
  static: Map<string, Node>;
  dynamic: Map<string, Node>;
  dynamicOrder: Array<[string, RegExp]>;
};

type Route = {
  pattern: AST.Pattern;
  variant: Variant;
};

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

export function createTree(patterns: Array<AST.Pattern>): Node {
  const root = createNode();
  const withDynamic: Set<Children> = new Set();

  for (const pattern of patterns) {
    for (const variant of variants(pattern)) {
      let node = root;

      // todo handle omitted protocol
      let child = node.protocol.static.get(variant.protocol);
      if (!child) {
        child = createNode();
        node.protocol.static.set(variant.protocol, child);
      }
      node = child;

      // hostname
      for (const segment of variant.hostname) {
        const isDynamic = segment.includes(':');
        const children = isDynamic ? node.hostname.dynamic : node.hostname.static;
        let child = children.get(segment);
        if (!child) {
          child = createNode();
          children.set(segment, child);
          withDynamic.add(node.hostname);
        }
        node = child;
      }

      // pathname
      for (const segment of variant.pathname) {
        const isDynamic = segment.includes(':');
        const children = isDynamic ? node.pathname.dynamic : node.pathname.static;
        let child = children.get(segment);
        if (!child) {
          child = createNode();
          children.set(segment, child);
          withDynamic.add(node.pathname);
        }
        node = child;
      }

      if (node.route) {
        throw new RouteConflictError(node.route, { pattern, variant });
      }
      node.route = { pattern, variant };
    }
  }

  for (const children of withDynamic) {
    const dynamicOrder: Array<[string, RegExp]> = [];
    for (const key of children.dynamic.keys()) {
      dynamicOrder.push([key, toRegExp(key)]);
    }
    dynamicOrder.sort((a, b) => sortByStaticLengths(a[0], b[0]));
    children.dynamicOrder = dynamicOrder;
  }

  return root;
}

const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function toRegExp(segment: string): RegExp {
  return new RegExp('^' + escape(segment).replaceAll(':', '(\\w+)') + '$');
}
