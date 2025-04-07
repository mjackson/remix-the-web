import type * as AST from '../ast.ts';
import { split } from '../parse.ts';
import type { Node } from './tree.ts';
import type { Variant } from './variants';

export type _URL = Array<{
  type: 'protocol' | 'hostname' | 'pathname';
  segment: string;
}>;

type StateItem = {
  urlIndex: number;
  paramValues?: Array<string>;

  node: Node; // convenience
  /**
   * For backtracking
   *
   * undefined -> processing the static match (there can only be one of these)
   * 0 - dynamic children length -> should start up again at the i-th dynamic child
   * beyond that -> done! (or glob but this isn't implemented yet)
   */
  bookmark?: number;
};
type State = Array<StateItem>;

type MatchResult = {
  pattern: AST.Pattern;
  variant: Variant;
  params: Params;
};

function backtrack(state: State) {
  state.pop();
  const parent = state.at(-1);
  if (parent) {
    parent.bookmark = parent.bookmark === undefined ? 0 : parent.bookmark + 1;
  }
}

function toURL(url: string): _URL {
  const parts = split(url);
  const protocol = url.slice(...parts.protocol!);
  const hostname = url
    .slice(...parts.hostname!)
    .split('.')
    .reverse();
  const pathname = url.slice(...parts.pathname!).split('/');

  return [
    { type: 'protocol', segment: protocol },
    ...hostname.map((segment) => ({ type: 'hostname' as const, segment })),
    ...pathname.map((segment) => ({ type: 'pathname' as const, segment })),
  ];
}

export function* match(tree: Node, _url: string): Generator<MatchResult> {
  const url = toURL(_url);
  const state: State = [{ urlIndex: 0, node: tree }];

  outer: while (state.length > 0) {
    const current = state.at(-1)!;

    if (current.urlIndex === url.length) {
      const { route } = current.node;
      if (route) {
        const paramValues = state.flatMap((item) => item.paramValues ?? []);
        const params = getParams(route.variant.paramSlots, paramValues);
        yield { ...route, params };
      }
      backtrack(state);
      continue;
    }

    const { type, segment } = url[current.urlIndex];
    const children = current.node[type];

    // static
    if (current.bookmark === undefined) {
      const child = children.static.get(segment);
      if (child) {
        state.push({
          urlIndex: current.urlIndex + 1,
          node: child,
        });
        continue;
      }
      current.bookmark = 0;
    }

    // dynamic
    for (let i = current.bookmark; i < children.dynamicOrder.length; i++) {
      const [key, regex] = children.dynamicOrder[i];
      const match = regex.exec(segment);
      if (!match) continue;

      const child = children.dynamic.get(key)!;
      state.push({
        node: child,
        paramValues: match.slice(1),
        urlIndex: current.urlIndex + 1,
        bookmark: i,
      });
      continue outer;
    }

    // todo: glob

    backtrack(state);
  }
}

type Params = Record<string, Array<string | undefined>>;
function getParams(paramSlots: Array<[string, boolean]>, paramValues: Array<string>): Params {
  const params: Params = {};
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
