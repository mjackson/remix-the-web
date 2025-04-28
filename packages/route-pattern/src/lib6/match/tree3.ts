import type { RoutePattern, RouteVariant } from '../route-pattern';

export function blah() {}

// step 1: create routes tree (correctness)
// step 2: create matcher (perf)

type Node<Data> = {
  children: Map<string, Map<string, Node<Data>>>;
  data?: Data;
};

type Route = {
  pattern: RoutePattern;
  variant: RouteVariant;
};

function create(patterns: Array<RoutePattern>) {
  const root: Node<Route> = {} as any;
  for (const pattern of patterns) {
    for (const variant of pattern.variants()) {
      let node = root;

      let protocol = root.children.get('protocol');
      if (!protocol) {
        protocol = new Map();
        root.children.set('protocol', protocol);
      }
      if (variant.protocol) {
        let child = protocol.get(variant.protocol);
      } else {
        node = node.children.get('');
      }
    }
  }
}
