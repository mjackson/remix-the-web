/**
 * Expands an pattern with optionals into multiple patterns without optionals.
 * Does not support nested optionals.
 *
 * For example:
 *
 * ```ts
 * expandOptionals("the (quick) brown fox (jumped)")
 * // -> [
 * //  "the  brown  fox",
 * //  "the  brown fox jumped",
 * //  "the quick brown fox",
 * //  "the quick brown fox jumped",
 * // ]
 * ```
 *
 * @throws {ParseError} when parentheses are nested or unmatched
 */
export function expandOptionals(pattern: string): Set<string> {
  const tokens = scan(pattern);
  const graph = parse(tokens);

  const paths: Set<string> = new Set();
  traverse(graph, (path) => {
    paths.add(path.filter((x) => x !== '(' && x !== ')').join(''));
  });
  return paths;
}

/**
 * Tokenize the pattern into:
 * - open parenthesis `(`
 * - close parenthesis `)`
 * - sequence of non-parenthesis characters
 *
 * Similar to `pattern.split(/[()]/)`, but the individual parens characters are also part of the result.
 *
 * For example:
 * ```ts
 * scan("the (quick) brown fox (jumped)") // -> ["the ", "(", "quick", ")", " brown fox ", "(", "jumped", ")"]
 * ```
 */
function scan(pattern: string): Array<string> {
  const tokens = [];

  let current = '';
  for (const char of pattern) {
    if (char === '(' || char === ')') {
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      continue;
    }
    current += char;
  }
  current && tokens.push(current);
  return tokens;
}

type ID = number;
type Graph = Map<ID, { token: string; children: Array<ID> }>;

type ParseErrorType = 'unmatched-parenthesis' | 'nested-parenthesis';
export class ParseError extends Error {
  type: ParseErrorType;
  index: number;

  constructor(type: ParseErrorType, index: number) {
    super(`${type} at index: ${index}`);
    this.name = 'ParseError';

    this.type = type;
    this.index = index;
  }
}

/**
 * Create a graph representing possible ways to interpret the optionals for a given pattern.
 * For example, `the (quick) brown fox (jumped)` gets represented as:
 *
 * "the " ─ "(" ┬─────────┬ ")" ─ "brown fox" ─ "(" ┬──────────┬ ")"
 *              └ "quick" ┘                         └ "jumped" ┘
 *
 * where each open paren `(` lets you choose if you want to skip straight to its matching close paren `)`,
 * or if you want to include the parenthesized token.
 *
 * The graph has nodes for each token, using the token index as the node ID for representing edges between nodes:
 *
 * ```ts
 * new Map([
 *   [0, { token: "the ", children: [1] }],
 *   [1, { token: "(", children: [2,3] }],
 *   [2, { token: "quick", children: [3] }],
 *   [3, { token: ")", children: [4] }],
 *   [4, { token: " brown fox ", children: [5] }],
 *   [5, { token: "(", children: [6,7] }],
 *   [6, { token: "jumped", children: [7] }],
 *   [7, { token: ")", children: [] }],
 * ])
 * ```
 *
 * @throws {ParseError} when parentheses are nested or unmatched
 */
function parse(tokens: Array<string>): Graph {
  const graph: Graph = new Map();

  const stack: Array<number> = [];
  let prev: number | undefined = undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '(') {
      if (stack.length > 0) {
        throw new ParseError('nested-parenthesis', i);
      }
      stack.push(i);
    } else if (token === ')') {
      const match = stack.pop();
      if (match === undefined) {
        throw new ParseError('unmatched-parenthesis', i);
      }
      graph.get(match)!.children.push(i);
    }

    graph.set(i, { token, children: [] });
    prev !== undefined && graph.get(prev)?.children.push(i);
    prev = i;
  }
  if (stack.length !== 0) {
    throw new ParseError('unmatched-parenthesis', stack.pop()!);
  }
  return graph;
}

/**
 * Walks through the token graph produced by {@link parse} and calls the callback for each complete path through the graph.
 */
function traverse(graph: Graph, callback: (path: Array<string>) => void) {
  function recurse(id: ID, path: Array<string>) {
    const node = graph.get(id)!;
    path = [...path, node.token];
    if (node.children.length === 0) {
      callback(path);
      return;
    }
    for (const child of node.children) {
      recurse(child, path);
    }
  }
  recurse(0, []);
}
