import * as AST from './ast.ts';
import { split, type Span } from './split.ts';

type ParseErrorType = 'unmatched-paren' | 'nested-paren' | 'missing-param-name';
export class ParseError extends Error {
  type: ParseErrorType;
  index: number;

  constructor(type: ParseErrorType, index: number) {
    super();
    this.type = type;
    this.index = index;
  }

  // todo nice error message
}

export class RoutePattern {
  _ast: AST.Pattern;
  #source?: string;

  /** todo jsdoc: call `.parse` instead */
  private constructor(ast: AST.Pattern) {
    this._ast = ast;
  }

  static parse(source: string): RoutePattern {
    const spans = split(source);
    // todo disallow params in protocol?
    return new RoutePattern({
      protocol: spans.protocol ? parsePart(source, spans.protocol) : [],
      hostname: spans.hostname ? parsePart(source, spans.hostname) : [],
      pathname: spans.pathname ? parsePart(source, spans.pathname) : [],
      search: spans.search ? source.slice(...spans.search) : '',
    });
  }

  get source(): string {
    if (this.#source === undefined) {
      let source = '';
      if (this._ast.hostname.length > 0) {
        source += sourcePart(this._ast.protocol);
        source += '://';
        source += sourcePart(this._ast.hostname);

        if (this._ast.pathname.length > 0) {
          source += '/';
        }
      }
      source += sourcePart(this._ast.pathname);
      if (this._ast.search) {
        source += '?';
        source += this._ast.search;
      }
      this.#source = source;
    }
    return this.#source;
  }

  join(other: RoutePattern) {
    const pathname = [...this._ast.pathname];
    if (other._ast.pathname.length > 0) {
      if (pathname.length > 0) {
        pathname.push({ type: 'text', text: '/' });
      }
      pathname.push(...other._ast.pathname);
    }

    return new RoutePattern({
      protocol: other._ast.protocol.length > 0 ? other._ast.protocol : this._ast.protocol,
      hostname: other._ast.hostname.length > 0 ? other._ast.hostname : this._ast.hostname,
      pathname,
      search: this._ast.search + other._ast.search, // todo
    });
  }
}

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const textRE = /^[^():]+/;

function parsePart(source: string, span: Span): AST.Part {
  const result: AST.Part = [];

  let optional: AST.Optional | null = null;
  let optionalIndex: number | null = null;

  let i = span[0];
  while (i < span[1]) {
    const char = source[i];

    // optional
    if (char === '(') {
      if (optional) throw new ParseError('nested-paren', i);
      optional = { type: 'optional', items: [] };
      optionalIndex = i;
      i += 1;
      continue;
    }
    if (char === ')') {
      if (!optional) throw new ParseError('unmatched-paren', i);
      result.push(optional);
      optional = null;
      optionalIndex = null;
      i += 1;
      continue;
    }

    // param
    if (char === ':') {
      const match = identifierRE.exec(source.slice(i + 1, span[1]));
      if (!match) throw new ParseError('missing-param-name', i);
      const name = match[0];
      const node: AST.Param = { type: 'param', name };
      optional ? optional.items.push(node) : result.push(node);
      i += 1 + name.length;
      continue;
    }

    // text
    const match = textRE.exec(source.slice(i, span[1]));
    if (!match) throw new Error('todo internal');
    const text = match[0];
    const node: AST.Text = { type: 'text', text };
    optional ? optional.items.push(node) : result.push(node);
    i += text.length;
  }
  if (optional) {
    throw new ParseError('unmatched-paren', optionalIndex!);
  }

  return result;
}

function sourcePart(part: AST.Part): string {
  let source = '';
  AST.traverse(part, {
    param: (node) => (source += ':' + node.name),
    text: (node) => (source += node.text),
    optionalOpen: () => (source += '('),
    optionalClose: () => (source += ')'),
  });
  return source;
}
