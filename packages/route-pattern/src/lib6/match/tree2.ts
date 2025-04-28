import type { RoutePattern, RouteVariant } from '../route-pattern';

export function blah() {}

// step 1: create routes tree (correctness)
// step 2: create matcher (perf)

type Node<Data> = {
  children: Map<string, Children<Data>>;
  data?: Data;
};
type Children<Data> = {
  static: Map<string, Node<Data>>;
  dynamic: Map<string, Node<Data>>;
  dynamicOrder: Array<[RegExp, string]>;
  glob?: Node<Data>;
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

      root.children.get('protocol');
      variant.protocol;
    }
  }
}
