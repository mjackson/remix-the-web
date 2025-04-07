import type * as AST from './ast.ts';
import { choice, lit, many0, ParseError, regex, Parser, expected } from './parser.lib.ts';
import { err, ok } from './result.ts';

const optional = <Data>(parser: Parser<Data>): Parser<AST.Optional<Data>> => {
  return new Parser((state) => {
    const firstChar = state.source[state.index];
    if (firstChar === ')') return err(new ParseError('unmatched )', state.index + 1));
    if (firstChar !== '(') return err(expected(state.index, `'('`));

    const result = parser.parse({ ...state, index: state.index + 1 });
    if (!result.ok) return result;
    state = result.value;

    const char = state.source[state.index];
    if (char === '(') return err(new ParseError('nested (', state.index + 1));
    if (char !== ')') return err(new ParseError('unmatched (', state.index + 1));
    return result;
  }).map((data) => ({ type: 'optional', option: data }));
};

const protocolText: Parser<AST.Text> = regex(/^[^():]+/).map((data) => {
  return {
    type: 'text',
    text: data,
  };
});
const protocol: Parser<AST.Protocol> = many0(choice([optional(protocolText), protocolText]));

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const param: Parser<AST.Param> = new Parser(({ source, index }) => {
  const char = source[index];
  if (char !== ':') return err(expected(index, `':'`));
  const match = identifierRE.exec(source.slice(index + 1));
  if (!match) return err(new ParseError('missing param name', index + 1));
  return ok({ source, index: index + 1 + match[0].length, data: match[0] });
}).map((data) => ({
  type: 'param',
  name: data,
}));

const hostnameSeparator: Parser<AST.Separator> = lit('.').map(() => ({
  type: 'separator' as const,
}));
const hostnameText: Parser<AST.Text> = regex(/^[^():/]+/).map((data) => ({
  type: 'text' as const,
  text: data,
}));
const hostnameContent = choice([param, hostnameSeparator, hostnameText]);
const hostname: Parser<AST.Hostname> = many0(
  choice([optional(many0(hostnameContent)), hostnameContent]),
);

const pathnameSeparator: Parser<AST.Separator> = lit('/').map(() => ({
  type: 'separator' as const,
}));
const pathnameText: Parser<AST.Text> = regex(/^[^():?]+/).map((data) => ({
  type: 'text' as const,
  text: data,
}));
const pathnameContent = choice([param, pathnameSeparator, pathnameText]);
const pathname: Parser<AST.Pathname> = many0(
  choice([optional(many0(pathnameContent)), pathnameContent]),
);

// split!

export const parse = (source: string) => {
  return pattern.parse({ source, index: 0 });
};
