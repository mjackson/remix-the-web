import type { Node } from './tree.ts';

type State = {
  part: { type: 'protocol' | 'hostname' | 'pathname'; index?: number };
  paramValues?: Array<string>;

  node: Node;
  bookmark?: { type: 'dynamic'; index: number };
};
type URL = {
  protocol: string;
  hostname: Array<string>;
  pathname: Array<string>;
};

function backtrack(stack: Array<State>) {
  if (!stack.pop()) return;

  const state = stack.at(-1);
  if (!state) return;

  // prettier-ignore
  state.bookmark =
    state.bookmark === undefined ? { type: 'dynamic', index: 0 } :
    { type: 'dynamic', index: state.bookmark.index + 1 }
}

// return match | null + process stack??
export function process(stack: Array<State>, url: URL) {
  while (stack.length > 0) {
    processPart(stack, url, {
      onEnd: () => {},
    });
  }
}

function processPart(
  stack: Array<State>,
  url: URL,
  {
    onEnd,
  }: {
    onEnd: (stack: Array<State>) => void;
  },
) {
  // todo if node.type doesn't match part.type, error
  const state = stack.at(-1)!;
  const index = state.part.index ?? 0;

  const part = url[state.part.type];

  if (index === part.length) {
    const end = state.node.end;
    if (!end) {
      backtrack(stack);
      return;
    }
    return onEnd(stack);
  }

  const segment = part[index];
  if (!state.bookmark) {
    const child = state.node.staticChildren.get(segment);
    if (child) {
      stack.push({
        part: { type: state.part.type, index: (state.part.index ?? 0) + 1 },
        node: child,
      });
      return;
    }
    state.bookmark = { type: 'dynamic', index: 0 };
  }

  if (state.bookmark.type === 'dynamic') {
    for (let i = state.bookmark.index; i < state.node.dynamicChildrenOrder.length; i++) {
      const [key, regex] = state.node.dynamicChildrenOrder[i];
      const match = regex.exec(segment);
      if (!match) continue;
      state.bookmark.index = i + 1;
      const child = state.node.dynamicChildren.get(key)!;
      stack.push({
        part: { type: state.part.type, index: (state.part.index ?? 0) + 1 },
        node: child,
      });
      return;
    }
  }

  backtrack(stack);
  return;
}
