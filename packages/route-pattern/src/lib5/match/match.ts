import type { Node } from './tree.ts';

type State = {
  node: Node;
  child: { type: 'static' | 'dynamic' | 'glob'; index: number };
  paramValues: Array<string>;

  url: { part: 'protocol' | 'hostname' | 'pathname'; index: number };
};

type State2 = {
  part: { type: 'protocol' | 'hostname' | 'pathname'; index?: number };
  paramValues?: Array<string>;
  bookmark: { type: 'static' | 'dynamic' | 'glob'; index?: number };

  // convenience
  node: Node;
};
type URL = {
  protocol: string;
  hostname: Array<string>;
  pathname: Array<string>;
};

/*
stack:
- part: protocol(0), [],       edge: static
- part: hostname(0), ['blah'], edge: dynamic(3)
- part: hostname(1), [],       edge: static
- part: hostname(2), [],       edge: glob
*/

export function process(
  stack: Array<State>,
  url: {
    protocol: Array<string>; // length 0
    hostname: Array<string>; // todo reverse!
    pathname: Array<string>;
  },
) {
  const state = stack.at(-1)!;
  const part = url[state.url.part];
  const index = state.url.index ?? 0;
  if (index === part.length) {
    // todo end?
  }

  const segment = part[index];
  if (state.child.type === 'static') {
    const child = state.node.staticChildren.get(segment);
    if (child) {
      stack.push({
        node: child,
        child: { type: 'static', index: 0 },
        paramValues: state.paramValues,
        url: { ...state.url, index: state.url.index + 1 },
      });
      return;
    }
    state.child = { type: 'dynamic', index: 0 };
    return;
  }

  if (state.child.type === 'dynamic') {
    for (let i = state.child.index; i < state.node.dynamicChildrenOrder.length; i++) {
      const [key, regex] = state.node.dynamicChildrenOrder[i];
      const match = regex.exec(segment);
      if (match) {
        state.child.index = i;
        const child = state.node.dynamicChildren.get(key)!;
        stack.push({
          node: child,
          child: { type: 'static', index: 0 },
          paramValues: [...state.paramValues, ...match.slice(1)],
          url: { ...state.url, index: state.url.index + 1 },
        });
        return;
      }
    }
    state.child = { type: 'glob', index: 0 };
    return;
  }

  if (state.child.type === 'glob') {
    if (state.node.glob) {
      stack.push({
        node: state.node.glob,
        child: { type: 'static', index: 0 },
        paramValues: state.paramValues, // TODO `*` pattern?
        url: { ...state.url, index: state.url.index + 1 },
      });
      return;
    }
  }
}

function getParams(paramSlots: Array<[string, boolean]>, paramValues: Array<string>) {
  const params: Record<string, Array<string | undefined>> = {};
  let i = 0;
  for (const [name, isDefined] of paramSlots) {
    params[name] ??= [];
    if (isDefined) {
      params[name].push(paramValues[i++]);
    } else {
      params[name].push(undefined);
    }
  }
  return params;
}
