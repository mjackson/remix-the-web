import type * as AST from '../ast.ts';
import type { Node } from './tree2.ts';
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
  params: Record<string, Array<string>>;
};

export function* match(tree: Node, url: _URL): Generator<MatchResult> {
  const state: State = [{ urlIndex: 0, node: tree }];

  const backtrack = () => {
    state.pop();
    const parent = state.at(-1);
    if (parent) {
      parent.bookmark = parent.bookmark === undefined ? 0 : parent.bookmark + 1;
    }
  };

  outer: while (state.length > 0) {
    const current = state.at(-1)!;

    if (current.urlIndex === url.length) {
      if (current.node.route) {
        yield { ...current.node.route, params: {} }; // todo params
      }
      backtrack();
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
    for (let i = current.bookmark; children.dynamicOrder.length; i++) {
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

    backtrack();
  }
}
