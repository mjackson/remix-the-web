import type { Node } from './tree.ts';

type State = {
  part: { type: 'protocol' | 'hostname' | 'pathname'; index?: number };
  paramValues?: Array<string>;

  node: Node;
  bookmark?: { type: 'dynamic' | 'glob'; index?: number }; // todo: no bookmark means static?
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
    state.bookmark.type === 'dynamic' ? { type: 'dynamic', index: (state.bookmark.index ?? 0) + 1 } :
    {type: 'glob'}
}

// return match | null + process stack??
export function process(stack: Array<State>, url: URL) {
  const state = stack.at(-1);
  if (!state) return;
  const { node, part } = state;

  if (node.type === 'protocol') {
    if (part.type !== 'protocol') throw new Error('todo');

    if (!state.bookmark) {
      const child = node.staticChildren.get(url.protocol);
      if (child) {
        stack.push({
          part: { type: 'hostname', index: 0 },
          node: child,
        });
        return;
      }
      state.bookmark = { type: 'glob' };
    }

    if (state.bookmark.type === 'dynamic') {
      throw new Error('todo internal');
    }

    if (state.bookmark.type === 'glob') {
      const child = node.glob;
      if (child) {
        stack.push({
          part: { type: 'hostname', index: 0 },
          node: child,
        });
        return;
      }
    }
    stack.pop();
    return;
  }

  if (node.type === 'hostname') {
    if (part.type !== 'hostname') throw new Error('todo');

    const index = part.index ?? 0;
    if (index === url.hostname.length) {
      const end = node.end;
      if (!end) {
        backtrack(stack);
        return;
      }
      // action: end! push next or match!
      stack.push({
        part: { type: 'pathname', index: 0 },
        node: end,
      });
      return;
    }

    const segment = url.hostname[index];
    if (!state.bookmark) {
      const child = node.staticChildren.get(segment);
      if (child) {
        // action: push same
        stack.push({
          part: { type: 'hostname', index: (part.index ?? 0) + 1 },
          node: child,
        });
        return;
      }
      state.bookmark = { type: 'dynamic', index: 0 };
    }

    if (state.bookmark.type === 'dynamic') {
      for (let i = state.bookmark.index ?? 0; i < node.dynamicChildrenOrder.length; i++) {
        const [key, regex] = node.dynamicChildrenOrder[i];
        const match = regex.exec(segment);
        if (!match) continue;
        const child = node.dynamicChildren.get(key)!;
        // action: push same
        stack.push({
          part: { type: 'hostname', index: (part.index ?? 0) + 1 },
          node: child,
        });
        return;
      }
      state.bookmark = { type: 'glob' };
    }

    if (state.bookmark.type === 'glob') {
      const child = node.glob;
      if (child) {
        // action: push next
        stack.push({
          part: { type: 'pathname', index: 0 },
          node: child,
        });
        return;
      }
    }
    backtrack(stack);
    return;
  }

  if (node.type === 'pathname') {
    processPart(stack, url, {
      onEnd: () => {},
      onGlob: () => {},
    });
  }
}

function processPart(
  stack: Array<State>,
  url: URL,
  {
    onEnd,
    onGlob,
  }: {
    onEnd: (stack: Array<State>) => void;
    onGlob: (stack: Array<State>) => void;
  },
) {
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
    for (let i = state.bookmark.index ?? 0; i < state.node.dynamicChildrenOrder.length; i++) {
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
    state.bookmark = { type: 'glob' };
  }

  if (state.bookmark.type === 'glob') {
    const child = state.node.glob;
    if (child) {
      onGlob(stack);
      return;
    }
  }
  backtrack(stack);
  return;
}
