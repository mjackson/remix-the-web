import { err, ok } from './result.ts';
import { choice, lit, many0, ParseError, regex, seq, Parser, opt, expected } from './parser.lib.ts';

// error needs: type, parsed: number,

// AST

type Optional<T> = {
  type: 'optional';
  option: T;
};
type Separator = {
  type: 'separator';
};
type Param = {
  type: 'param';
  name: string;
};
type Text = {
  type: 'text';
  text: string;
};

// parsing

// TODO fixup parse error indices for optional
const optional = <Data>(parser: Parser<Data>): Parser<Optional<Data>> => {
  return new Parser((state) => {
    const firstChar = state.source[state.index];
    if (firstChar === ')') return err(new ParseError('unmatched )', state.index));
    if (firstChar !== '(') return err(expected(state.index));

    const result = parser.parse({ ...state, index: state.index + 1 });
    if (!result.ok) return result;
    state = result.value;

    const char = state.source[state.index];
    if (char === '(') return err(new ParseError('nested (', state.index));
    if (char !== ')') return err(new ParseError('unmatched (', state.index));
    return result;
  }).map((data) => ({ type: 'optional', option: data }));
};

const protocolText: Parser<Text> = regex(/[^():]+/).map((data) => ({ type: 'text', text: data }));
const protocol = many0(choice([optional(protocolText), protocolText]));

const identifierRE = /^[a-zA-Z_$][\w$]*/;
const param: Parser<Param> = new Parser(({ source, index }) => {
  const char = source[index];
  if (char !== ':') return err(expected(index));
  const match = identifierRE.exec(source.slice(index + 1));
  if (!match) return err(new ParseError('missing param name', index));
  return ok({ source, index: index + 1 + match[0].length, data: match[0] });
}).map((data) => ({
  type: 'param',
  name: data,
}));

const hostnameSeparator: Parser<Separator> = lit('.').map(() => ({ type: 'separator' as const }));
const hostnameText: Parser<Text> = regex(/[^():/]/).map((data) => ({
  type: 'text' as const,
  text: data,
}));
const hostnameContent = choice([param, hostnameSeparator, hostnameText]);
const hostname = many0(choice([optional(many0(hostnameContent)), hostnameContent]));

const pathnameSeparator: Parser<Separator> = lit('/').map(() => ({ type: 'separator' as const }));
const pathnameText: Parser<Text> = regex(/[^():?]/).map((data) => ({
  type: 'text' as const,
  text: data,
}));
const pathnameContent = choice([param, pathnameSeparator, pathnameText]);
const pathname = many0(choice([optional(many0(pathnameContent)), pathnameContent]));

export const pattern = choice([
  seq([opt(protocol), lit('://'), hostname, opt(seq([lit('/'), pathname]))]).map((data) => ({
    protocol: data[0] ?? [],
    hostname: data[2],
    pathname: data[3]?.[1] ?? [],
  })),
  pathname.map((data) => ({
    protocol: [],
    hostname: [],
    pathname: data,
  })),
]);

const parse = (source: string) => {
  return pattern.parse({ source, index: 0 });
};

const result = parse('https://remix.run/products/:id');
if (!result.ok) throw Error();
const ast = result.value.data;
ast.hostname;
