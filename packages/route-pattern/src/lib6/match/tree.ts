import type { Variant } from '../part-pattern.ts';
import type { RoutePattern } from '../route-pattern.ts';
import { sortByStaticLengths } from '../utils/sort-by-static-lengths.ts';

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
  pattern: RoutePattern;
  variant: RouteVariant;
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

export type RouteVariant = {
  protocol?: string;
  hostname?: Variant;
  pathname?: Variant;
};

function* variants(pattern: RoutePattern): Generator<RouteVariant> {
  for (const protocol of pattern.protocol?.variants() ?? [undefined]) {
    for (const hostname of pattern.hostname?.variants() ?? [undefined]) {
      for (const pathname of pattern.pathname?.variants() ?? [undefined]) {
        yield {
          protocol: protocol?.source,
          hostname,
          pathname,
        };
      }
    }
  }
}

export function createTree(patterns: Array<RoutePattern>): Node {
  const root = createNode();
  const dynamic = {
    hostname: new Set<Children>(),
    pathname: new Set<Children>(),
  };
  for (const pattern of patterns) {
    for (const variant of variants(pattern)) {
      let node = root;

      if (variant.protocol) {
        let child = node.protocol.static.get(variant.protocol);
        if (!child) {
          child = createNode();
          node.protocol.static.set(variant.protocol, child);
        }
        node = child;
      }
      // todo handle omitted protocol with glob?

      // hostname
      if (variant.hostname) {
        const segments = variant.hostname.source.split('.').reverse();
        for (const segment of segments) {
          const isDynamic = segment.includes(':');
          const children = isDynamic ? node.hostname.dynamic : node.hostname.static;
          let child = children.get(segment);
          if (!child) {
            child = createNode();
            children.set(segment, child);
            dynamic.hostname.add(node.hostname);
          }
          node = child;
        }
      }
      // todo handle omitted hostname with glob?

      // pathname
      if (variant.pathname) {
        const segments = variant.pathname.source.split('/');
        for (const segment of segments) {
          const isDynamic = segment.includes(':');
          const children = isDynamic ? node.pathname.dynamic : node.pathname.static;
          let child = children.get(segment);
          if (!child) {
            child = createNode();
            children.set(segment, child);
            dynamic.pathname.add(node.pathname);
          }
          node = child;
        }
      }

      if (node.route) {
        throw new RouteConflictError(node.route, { pattern, variant });
      }
      node.route = { pattern, variant };
    }
  }

  setDynamicOrder(dynamic.hostname, /([^/])+/);
  setDynamicOrder(dynamic.pathname, /([^.])+/);

  return root;
}

const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function setDynamicOrder(blah: Set<Children>, paramValueRE: RegExp) {
  for (const children of blah) {
    const dynamicOrder: Array<[string, RegExp]> = [];
    for (const segment of children.dynamic.keys()) {
      const regex = new RegExp('^' + escape(segment).replaceAll(':', paramValueRE.source) + '$');
      dynamicOrder.push([segment, regex]);
    }
    dynamicOrder.sort((a, b) => sortByStaticLengths(a[0], b[0]));
    children.dynamicOrder = dynamicOrder;
  }
}
