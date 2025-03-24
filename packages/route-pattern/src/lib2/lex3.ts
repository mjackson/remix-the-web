import { err, ok, type Result } from './result.ts';
import { split } from './split.ts';

type Err = {
  type: 'missing-param-name' | 'unmatched-paren' | 'unrecognized';
  index: number;
};

type Span = [beginIndex: number, endIndex: number];
type Token = {
  span: Span;
} & ({ type: '(' | ')' } | { type: 'param'; name: string } | { type: 'text'; text: string });

type Tokenizer = (source: string, index: number) => Result<Token, Err> | null;

export function tokenize(tokenizers: Array<Tokenizer>) {
  return function (source: string): Result<Array<Token>, Err> {
    const tokens: Array<Token> = [];
    let index = 0;

    while (index < source.length) {
      let token: Result<Token, Err> | null = null;
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

const textRE = /^[^():]+/;
const text: Tokenizer = (source, index) => {
  const match = textRE.exec(source.slice(index));
  if (!match) return null;
  const text = match[0];
  return ok({ type: 'text', text, span: [index, index + text.length] });
};

const tokenizers = {
  protocol: tokenize([parens, text]),
  hostname: tokenize([parens, param, text]),
  pathname: tokenize([parens, param, text]),
  search: tokenize([text]),
};

type Optional = { type: 'optional'; option: Array<Param | Text>; span: Span };
type Param = { type: 'param'; name: string; span: Span };
type Text = { type: 'text'; text: string; span: Span };
type Part = Array<Optional | Param | Text>;

function parsePart(tokens: Array<Token>): Result<Part, Err> {
  const result: Part = [];

  let optional: Optional | null = null;
  for (const token of tokens) {
    if (token.type === '(') {
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

type AST = {
  protocol?: Part;
  hostname?: Part;
  pathname?: Part;
  search?: Part;
};

export function parse(pattern: string): Result<AST, Err> {
  const ast: AST = {};

  const parts = split(pattern);
  const partNames = Object.keys(parts) as Array<keyof typeof parts>;
  for (const partName of partNames) {
    const part = parts[partName];
    if (!part) continue;

    const tokens = tokenizers[partName](part);
    if (!tokens.ok) return tokens;

    const subast = parsePart(tokens.value);
    if (!subast.ok) return subast;

    ast[partName] = subast.value;
  }
  return ok(ast);
}
