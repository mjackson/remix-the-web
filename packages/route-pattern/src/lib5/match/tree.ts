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

type Route = {
  pattern: AST.Pattern;
  variant: Variant;
};
export type Node = {
  type: 'protocol' | 'hostname' | 'pathname';

  // children
  staticChildren: Map<string, Node>;
  dynamicChildren: Map<string, Node>;
  dynamicChildrenOrder: Array<[string, RegExp]>;
  glob?: Node;

  // transition to next URL part: protocol -> hostname -> pathname
  end?: Node;

  route?: Route;
};

function createNode(type: Node['type']): Node {
  return {
    type,
    staticChildren: new Map(),
    dynamicChildren: new Map(),
    dynamicChildrenOrder: [],
  };
}

// todo: reverse hostname (either here or in variant)
export function createMatcher(pattern: AST.Pattern) {
  const root = createNode('protocol');
  const nodesWithDynamicChildren: Node[] = [];

  for (const variant of variants(pattern)) {
    let node = root;

    // protocol
    if (variant.protocol === '') {
      let next = node.end;
      if (!next) {
        next = createNode('hostname');
        node.end = next;
      }
      node = next;
    } else {
      let next = node.staticChildren.get(variant.protocol);
      if (!next) {
        next = createNode('hostname');
        node.staticChildren.set(variant.protocol, next);
      }
      node = next;
    }

    // hostname
    for (const segment of variant.hostname) {
      const isDynamic = segment.includes(':');
      const children = isDynamic ? node.dynamicChildren : node.staticChildren;
      let next = children.get(segment);
      if (!next) {
        next = createNode('hostname');
        children.set(segment, next);
        if (isDynamic) nodesWithDynamicChildren.push(node);
      }
      node = next;
    }
    node.end = createNode('pathname');
    node = node.end;

    // pathname
    for (const segment of variant.pathname) {
      const isDynamic = segment.includes(':');
      const children = isDynamic ? node.dynamicChildren : node.staticChildren;
      let next = children.get(segment);
      if (!next) {
        next = createNode('pathname');
        children.set(segment, next);
        if (isDynamic) nodesWithDynamicChildren.push(node);
      }
      node = next;
    }

    if (node.route) {
      throw new RouteConflictError(node.route, { pattern, variant });
    }
    node.route = { pattern, variant };
  }

  for (const node of nodesWithDynamicChildren) {
    const dynamicChildrenOrder: Array<[string, RegExp]> = [];
    for (const segment of node.dynamicChildren.keys()) {
      dynamicChildrenOrder.push([segment, toRegExp(segment)]);
    }
    dynamicChildrenOrder.sort((a, b) => sortByStaticLengths(a[0], b[0]));
    node.dynamicChildrenOrder = dynamicChildrenOrder;
  }

  return root;
}

const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function toRegExp(segment: string): RegExp {
  return new RegExp('^' + escape(segment).replaceAll(':', '(\\w+)') + '$');
}
