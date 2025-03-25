import type * as AST from './ast.ts';
import { parse } from './parse.ts';

export class RoutePattern {
  readonly ast: AST.Pattern;

  constructor(ast: AST.Pattern) {
    this.ast = ast;
  }

  static parse(source: string) {
    const ast = parse(source);
    if (!ast.ok) throw new Error(ast.error.type); // TODO better error / message
    return new RoutePattern(ast.value);
  }

  get source(): string {
    let source = '';
    if (this.ast.protocol) {
      source += partToSource(this.ast.protocol);
    }
    if (this.ast.hostname) {
      source += '://';
      source += partToSource(this.ast.hostname);
    }
    if (this.ast.pathname) {
      if (this.ast.hostname) source += '/';
      source += partToSource(this.ast.pathname);
    }

    if (this.ast.search) {
      source += '?';
      const only = this.ast.search[0];
      if (only.type !== 'text') throw new Error();
      source += only.text;
    }

    return source;
  }
}

function partToSource(part: AST.Part) {
  let source = '';
  for (const outer of part) {
    if (outer.type === 'text') source += outer.text;
    if (outer.type === 'param') source += ':' + outer.name;
    if (outer.type === 'optional') {
      source += '(';
      for (const inner of outer.option) {
        if (inner.type === 'text') source += inner.text;
        if (inner.type === 'param') source += ':' + inner.name;
      }
      source += ')';
    }
  }
  return source;
}
