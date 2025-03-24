import type * as AST from './ast.ts';
import { err, ok, type Result } from './result.ts';
import { split } from './split.ts';

export type ParseError = {
  type: 'missing-param-name' | 'unmatched-paren' | 'unrecognized';
  index: number;
};

type Token = {
  span: AST.Span;
} & ({ type: '(' | ')' } | { type: 'param'; name: string } | { type: 'text'; text: string });

type Tokenizer = (source: string, index: number) => Result<Token, ParseError> | null;

export function tokenize(tokenizers: Array<Tokenizer>) {
  return function (source: string): Result<Array<Token>, ParseError> {
    const tokens: Array<Token> = [];
    let index = 0;

    while (index < source.length) {
      let token: Result<Token, ParseError> | null = null;
      for (const tokenize of tokenizers) {
        token = tokenize(source, index);
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

const parens: Tokenizer = (source, index) => {
  const char = source[index];
  if (char === '(' || char === ')') {
    return ok({ type: char, span: [index, index + 1] });
  }
  return null;
};

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const param: Tokenizer = (source, index) => {
  const char = source[index];
  if (char !== ':') return null;
  const match = identifierRE.exec(source.slice(index + 1));
  if (!match) return err({ type: 'missing-param-name', index });
  const name = match[0];
  return ok({ type: 'param', name, span: [index, index + 1 + name.length] });
};

const text =
  (regex: RegExp): Tokenizer =>
  (source, index) => {
    const match = regex.exec(source.slice(index));
    if (!match) return null;
    const text = match[0];
    return ok({ type: 'text', text, span: [index, index + text.length] });
  };

const tokenizers: Record<AST.PartName, ReturnType<typeof tokenize>> = {
  protocol: tokenize([parens, text(/^[^():?/.]+/)]),
  hostname: tokenize([parens, param, text(/^[^():]+/)]),
  pathname: tokenize([parens, param, text(/^[^():]+/)]),
  search: tokenize([text(/^.*/)]),
};

function parsePart(partName: AST.PartName, part: string): Result<AST.Part, ParseError> {
  const tokens = tokenizers[partName](part);
  if (!tokens.ok) return tokens;

  const result: AST.Part = [];

  let optional: AST.Optional | null = null;
  for (const token of tokens.value) {
    if (token.type === '(') {
      // nested paren error?
      if (optional) return err({ type: 'unmatched-paren', index: token.span[0] });
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

    if (token.type === 'param' || token.type === 'text') {
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

export function parse(pattern: string): Result<AST.Pattern, ParseError> {
  const ast: AST.Pattern = {};

  const parts = split(pattern);

  const partNames = Object.keys(parts) as Array<AST.PartName>;
  for (const partName of partNames) {
    const part = parts[partName];
    if (!part) continue;

    const subast = parsePart(partName, part);
    if (!subast.ok) return subast;

    ast[partName] = subast.value;
  }
  return ok(ast);
}
