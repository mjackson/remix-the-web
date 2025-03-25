import type * as AST from './ast.ts';
import { err, ok, type Result } from './result.ts';

export type ParseError = {
  type: 'missing-param-name' | 'unmatched-paren' | 'nested-paren' | 'unrecognized';
  index: number;
};

export function parse(source: string): Result<AST.Pattern, ParseError> {
  const parts = split(source);

  const ast: AST.Pattern = {};
  for (const [partName, span] of Object.entries(parts) as Array<[AST.PartName, AST.Span]>) {
    const part = parsePart({ source, span, partName });
    if (!part.ok) return part;
    ast[partName] = part.value;
  }
  return ok(ast);
}

type Split = Partial<Record<AST.PartName, AST.Span>>;
function split(source: string): Split {
  let index = 0;

  const result: Split = {};
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

function parsePart({
  source,
  span,
  partName,
}: {
  source: string;
  span: AST.Span;
  partName: AST.PartName;
}): Result<AST.Part, ParseError> {
  const tokens = tokenizers[partName](source, span);
  if (!tokens.ok) return tokens;

  const result: AST.Part = [];

  let optional: AST.Optional | null = null;
  for (const token of tokens.value) {
    if (token.type === '(') {
      if (optional) return err({ type: 'nested-paren', index: token.span[0] });
      optional = { type: 'optional', option: [], span: token.span };
      continue;
    }

    if (token.type === ')') {
      if (!optional) return err({ type: 'unmatched-paren', index: token.span[0] });
      optional.span[1] = token.span[1];
      result.push(optional);
      optional = null;
      continue;
    }

    if (token.type === 'param' || token.type === 'separator' || token.type === 'text') {
      if (optional) {
        optional.option.push(token);
      } else {
        result.push(token);
      }
    }
  }
  if (optional) {
    return err({ type: 'unmatched-paren', index: optional.span[0] });
  }
  return ok(result);
}

// Tokenize ----------------------------------------------------------------------------------------

type Token = {
  span: AST.Span;
} & (
  | { type: '(' | ')' }
  | { type: 'param'; name: string }
  | { type: 'text'; text: string }
  | { type: 'separator' }
);

type Tokenizer = (args: {
  source: string;
  span: AST.Span;
  index: number;
}) => Result<Token, ParseError> | null;

function tokenize(tokenizers: Array<Tokenizer>) {
  return function (source: string, span: AST.Span): Result<Array<Token>, ParseError> {
    const tokens: Array<Token> = [];
    let index = span[0];

    while (index < span[1]) {
      let token: Result<Token, ParseError> | null = null;
      for (const tokenize of tokenizers) {
        token = tokenize({ source, span, index });
        if (token) break;
      }
      if (!token) return err({ type: 'unrecognized', index });
      if (!token.ok) return token;
      tokens.push(token.value);
      index = token.value.span[1];
    }
    return ok(tokens);
  };
}

const parens: Tokenizer = ({ source, index }) => {
  const char = source[index];
  if (char === '(' || char === ')') {
    return ok({ type: char, span: [index, index + 1] });
  }
  return null;
};

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const param: Tokenizer = ({ source, span, index }) => {
  const char = source[index];
  if (char !== ':') return null;
  const match = identifierRE.exec(source.slice(index + 1, span[1]));
  if (!match) return err({ type: 'missing-param-name', index });
  const name = match[0];
  return ok({ type: 'param', name, span: [index, index + 1 + name.length] });
};

const text =
  (regex: RegExp): Tokenizer =>
  ({ source, span, index }) => {
    const match = regex.exec(source.slice(index, span[1]));
    if (!match) return null;
    const text = match[0];
    return ok({ type: 'text', text, span: [index, index + text.length] });
  };

const separator =
  (c: string): Tokenizer =>
  ({ source, index }) => {
    const char = source[index];
    if (char !== c) return null;
    return ok({ type: 'separator', span: [index, index + 1] });
  };

const tokenizers: Record<AST.PartName, ReturnType<typeof tokenize>> = {
  protocol: tokenize([parens, text(/^[^():?/.]+/)]),
  hostname: tokenize([parens, param, separator('.'), text(/^[^():.]+/)]),
  pathname: tokenize([parens, param, separator('/'), text(/^[^():/]+/)]),
  search: tokenize([text(/^.*/)]),
};
