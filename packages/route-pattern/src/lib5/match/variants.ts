import * as AST from '../ast.ts';
import type { RoutePattern } from '../route-pattern.ts';

export type Variant = {
  protocol: string;
  hostname: Array<string>;
  pathname: Array<string>;
  search: string;
  paramSlots: Array<[string, boolean]>;
};

export function* variants(pattern: RoutePattern): Generator<Variant> {
  const { paramNames, numOptionals } = discover(pattern);

  const max = 2 ** numOptionals;
  for (let state = 0; state < max; state++) {
    yield createVariant({ pattern, state, paramNames });
  }
}

function discover(pattern: RoutePattern) {
  const paramNames: Array<string> = [];

  let numOptionals = 0;
  for (const part of [pattern.ast.protocol, pattern.ast.hostname, pattern.ast.pathname]) {
    AST.traverse(part, {
      param: (node) => paramNames.push(node.name),
      optionalOpen: () => (numOptionals += 1),
    });
  }
  return { paramNames, numOptionals };
}

function createVariant({
  pattern,
  state,
  paramNames,
}: {
  pattern: RoutePattern;
  state: number;
  paramNames: Array<string>;
}): Variant {
  const paramIndices: Set<number> = new Set();

  let optionalId = 0;
  let paramId = 0;
  const shouldUseOptional = () => state & (1 << optionalId);

  function getPartVariant(part: AST.Part) {
    let source = '';
    AST.traverse(part, {
      optionalClose: () => (optionalId += 1),
      text: (node, optional) => {
        if (!optional || shouldUseOptional()) {
          source += node.text;
        }
      },
      param: (_, optional) => {
        if (!optional || shouldUseOptional()) {
          paramIndices.add(paramId);
          source += ':';
        }
        paramId += 1;
      },
    });
    return source;
  }

  const protocol = getPartVariant(pattern.ast.protocol);
  const hostname = getPartVariant(pattern.ast.hostname).split('.').reverse();
  const pathname = getPartVariant(pattern.ast.pathname).split('/');
  const paramSlots = paramNames.map((name, i) => [name, paramIndices.has(i)] as [string, boolean]);

  return { protocol, hostname, pathname, search: pattern.ast.search, paramSlots };
}
