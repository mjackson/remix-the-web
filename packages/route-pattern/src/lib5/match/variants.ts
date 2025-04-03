import * as AST from '../ast.ts';

// todo reverse hostname
export type Variant = {
  protocol: string;
  hostname: Array<string>;
  pathname: Array<string>;
  search: string;
  paramSlots: Array<[string, boolean]>;
};

export function* variants(pattern: AST.Pattern): Generator<Variant> {
  const { paramNames, paramIds, optionalIds } = discover(pattern);

  const max = 2 ** optionalIds.size;
  for (let state = 0; state < max; state++) {
    const variant = getVariant({
      pattern,
      state,
      paramNames,
      paramIds,
      optionalIds,
    });
    yield variant;
  }
}

function discover(pattern: AST.Pattern) {
  const paramNames: Array<string> = [];
  const paramIds: Map<AST.Span[0], number> = new Map();
  const optionalIds: Map<AST.Span[0], number> = new Map();
  for (const part of [pattern.protocol, pattern.hostname, pattern.pathname]) {
    AST.traverse(part, {
      param: (node) => {
        paramIds.set(node.span[0], paramNames.length);
        paramNames.push(node.name);
      },
      optional: (node) => {
        optionalIds.set(node.span[0], optionalIds.size);
      },
    });
  }
  return {
    paramNames,
    paramIds,
    optionalIds,
  };
}

function getVariant({
  pattern,
  state,
  paramNames,
  paramIds,
  optionalIds,
}: {
  pattern: AST.Pattern;
  state: number;
  paramNames: Array<string>;
  paramIds: Map<AST.Span[0], number>;
  optionalIds: Map<AST.Span[0], number>;
}): Variant {
  const paramIndices: Set<number> = new Set();
  function getPartVariant(part: AST.Part) {
    const shouldUse = (optional: AST.Optional) => {
      const id = optionalIds.get(optional.span[0])!;
      return state & (1 << id);
    };

    let source = '';
    AST.traverse(part, {
      text: (node, optional) => {
        if (!optional || shouldUse(optional)) {
          source += node.text;
        }
      },
      param: (node, optional) => {
        if (!optional || shouldUse(optional)) {
          const id = paramIds.get(node.span[0])!;
          paramIndices.add(id);
          source += ':';
        }
      },
    });
    return source;
  }

  const protocol = getPartVariant(pattern.protocol);
  const hostname = getPartVariant(pattern.hostname).split('.');
  const pathname = getPartVariant(pattern.pathname).split('/');
  const paramSlots = paramNames.map((name, i) => [name, paramIndices.has(i)] as [string, boolean]);

  return {
    protocol,
    hostname,
    pathname,
    search: pattern.search,
    paramSlots,
  };
}
