import type * as AST from './ast.ts';

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

export function split(source: string): Partial<Record<keyof AST.Pattern, AST.Span>> {
  let index = 0;

  const result: Partial<Record<keyof AST.Pattern, AST.Span>> = {};
  const protocolEnd = source.indexOf('://');
  if (protocolEnd !== -1) {
    if (protocolEnd !== 0) {
      result.protocol = [0, protocolEnd];
    }
    index = protocolEnd + 3;

    const hostnameEnd = source.indexOf('/', index);
    if (hostnameEnd === -1) {
      result.hostname = [index, source.length];
      return result;
    }
    result.hostname = [index, hostnameEnd];
    index = hostnameEnd + 1;
  }

  const pathnameEnd = source.indexOf('?');
  if (pathnameEnd === -1) {
    result.pathname = [index, source.length];
    return result;
  }
  result.pathname = [index, pathnameEnd];
  index = pathnameEnd + 1;

  result.search = [index, source.length];
  return result;
}

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const textRE = /^[^():]+/;

function parsePart(source: string, span: AST.Span): AST.Part {
  const result: AST.Part = [];
  let optional: AST.Optional | null = null;

  let i = span[0];
  while (i < span[1]) {
    const char = source[i];

    // optional
    if (char === '(') {
      if (optional) throw new ParseError('nested-paren', i);
      optional = { type: 'optional', items: [], span: [i, i] };
      i += 1;
      continue;
    }
    if (char === ')') {
      if (!optional) throw new ParseError('unmatched-paren', i);
      optional.span[1] = i + 1;
      result.push(optional);
      optional = null;
      i += 1;
      continue;
    }

    // param
    if (char === ':') {
      const match = identifierRE.exec(source.slice(i + 1, span[1]));
      if (!match) throw new ParseError('missing-param-name', i);
      const name = match[0];
      const node: AST.Param = { type: 'param', name, span: [i, i + 1 + name.length] };
      optional ? optional.items.push(node) : result.push(node);
      i += 1 + name.length;
      continue;
    }

    // text
    const match = textRE.exec(source.slice(i, span[1]));
    if (!match) throw new Error('todo internal');
    const text = match[0];
    const node: AST.Text = { type: 'text', text, span: [i, i + text.length] };
    optional ? optional.items.push(node) : result.push(node);
    i += text.length;
  }
  if (optional) {
    throw new ParseError('unmatched-paren', optional.span[0]);
  }

  return result;
}

export function parse(source: string): AST.Pattern {
  const spans = split(source);
  // todo disallow params in protocol?
  return {
    protocol: spans.protocol ? parsePart(source, spans.protocol) : [],
    hostname: spans.hostname ? parsePart(source, spans.hostname) : [],
    pathname: spans.pathname ? parsePart(source, spans.pathname) : [],
    search: spans.search ? source.slice(...spans.search) : '',
  };
}
