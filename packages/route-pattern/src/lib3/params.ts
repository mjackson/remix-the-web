import type * as AST from './ast.ts';

// matching:
// generates an array of param values
//
// to map values back to param keys, each route variant needs a way to associate its param indices with the pattern param indices
// variant param values: [hello, world]
// pattern param keys: [a,a,b,c,d,e,f]
// variant param -> pattern param: [1, 5]
// pattern param values: [_, hello, _, _, _, world, _]
// params: { a: [undefined, hello], b:, c:, d:, e: world, f:}
//
// why? because we don't know which pattern to use until we get to a route (leaf) of the variant
// so we build up the param values blindly until then
// route: { pattern, variant }
//
// how do we create the variant param -> pattern param piece?
// probably map<span[0], pattern param idx>, which needs to be created by the pattern
// so if the pattern params are computed as: Map<span[0], [pattern param idx, name]>
// then we can iterate for names
//

export function getParamNames(pattern: AST.Pattern) {
  const names: Array<string> = [];
  const locs: Map<number, number> = new Map();
  let count = 0;

  for (const outer of pattern.hostname ?? []) {
    if (outer.type === 'param') {
      names.push(outer.name);
      locs.set(outer.span[0], count++);
    }
    if (outer.type === 'optional') {
      for (const inner of outer.option) {
        if (inner.type === 'param') {
          names.push(inner.name);
          locs.set(inner.span[0], count++);
        }
      }
    }
  }

  for (const outer of pattern.pathname ?? []) {
    if (outer.type === 'param') {
      names.push(outer.name);
      locs.set(outer.span[0], count++);
    }
    if (outer.type === 'optional') {
      for (const inner of outer.option) {
        if (inner.type === 'param') {
          names.push(inner.name);
          locs.set(inner.span[0], count++);
        }
      }
    }
  }

  return locs;
}
