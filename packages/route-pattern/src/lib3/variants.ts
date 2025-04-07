import type * as AST from './ast.ts';
import type { RoutePattern } from './route-pattern.ts';

// 1. grab all params in order for pattern as `Map<span[0], index>`
// 2. for each variant
//    compute paramIndicies based on span[0]

type V = {
  protocol: string;
  hostname: Array<string>;
  pathname: Array<string>;
  // search
  route: {
    pattern: RoutePattern;
    paramIndices: Array<number>;
  };
};

function blah(pattern: AST.Pattern) {
  let index = 0;
  const beginToIndex: Map<number, number> = new Map();
  const names: Array<string> = [];
  visit(pattern.protocol ?? [], ({ item }) => {
    if (item.type === 'param') {
      beginToIndex.set(item.span[0], index++);
      names.push(item.name);
    }
  });

  // phase 1: determine param names, param begin2index, #optionals
  // phase 2: compute variants (as segments) + paramIndices
  //
  const result: Array<{ variant: Variant; paramIndices: Array<number> }> = [];
  for (let variant of getVariants(pattern)) {
    const paramIndices: Array<number> = [];
    for (const part of [variant.protocol, variant.hostname, variant.pathname]) {
      for (const param of part.filter((x) => x.type === 'param')) {
        const index = beginToIndex.get(param.span[0]);
        if (index === undefined) throw new Error();
        paramIndices.push(index);
      }
    }
    result.push({ variant, paramIndices });
  }
  return result;
}

function variants(pattern: AST.Pattern) {}

type Item = AST.Text | AST.Param | AST.Separator;

type X =
  | { type: 'optional'; optional: AST.Optional; item: Item }
  | { type: 'required'; item: Item };
function visit(part: AST.Part, callback: (path: X) => void) {
  for (const outer of part) {
    if (outer.type === 'text' || outer.type === 'param' || outer.type === 'separator') {
      callback({ type: 'required', item: outer });
      return;
    }
    if (outer.type === 'optional') {
      for (const inner of outer.option) {
        callback({ type: 'optional', optional: outer, item: inner });
      }
    }
  }
}

function partVariants(part: AST.Part) {
  let segment = '';
  for (const item of part) {
    if (item.type === 'text') segment += item.text;
  }
}

// ===========================

type Variant = Record<AST.PartName, PartVariant>;

export function segments(variant: Variant) {
  return {
    protocol: partSegments(variant.protocol),
    hostname: partSegments(variant.hostname),
    pathname: partSegments(variant.pathname),
    search: partSegments(variant.search),
  };
}

function partSegments(partVariant: PartVariant) {
  const segments: Array<string> = [];
  let current = '';
  for (const item of partVariant) {
    if (item.type === 'text') current += item.text;
    if (item.type === 'param') current += ':';
    if (item.type === 'separator') {
      segments.push(current);
      current = '';
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

export function* getVariants(pattern: AST.Pattern): Generator<Variant> {
  for (const protocol of getPartVariants(pattern.protocol ?? [])) {
    for (const hostname of getPartVariants(pattern.hostname ?? [])) {
      for (const pathname of getPartVariants(pattern.pathname ?? [])) {
        const _protocol = protocol
          .filter((x) => x.type === 'text')
          .map((x) => x.text)
          .join('');
        const _hostname = partSegments(hostname);
        const _pathname = partSegments(pathname);
        yield {
          protocol,
          hostname,
          pathname,
          search: [], // TODO
        };
      }
    }
  }
}

type PartVariant = Array<AST.Text | AST.Param | AST.Separator>;

export function* getPartVariants(part: AST.Part): Generator<PartVariant> {
  const optionals = part.filter((x) => x.type === 'optional');
  const max = 2 ** optionals.length;

  for (let i = 0; i < max; i++) {
    let j = 0;
    const variant: PartVariant = [];
    for (const outer of part) {
      if (outer.type === 'optional') {
        const shouldUseThisOptional = (1 << j++) & i;
        if (!shouldUseThisOptional) continue;
        for (const inner of outer.option) {
          variant.push(inner);
        }
        continue;
      }
      variant.push(outer);
    }
    yield variant;
  }
}
