import { choice, lit, many0, many1, opt, regex, seq, type Parser } from './parser.lib.ts';

type Text = { type: 'text'; value: string };

const protocolText: Parser<Text> = regex(/\w+/).map((data) => ({
  type: 'text' as const,
  value: data,
}));

const hostnameText: Parser<Text> = regex(/[^():/]+/).map((data) => ({
  type: 'text' as const,
  value: data,
}));

const pathnameText: Parser<Text> = regex(/[^():?]+/).map((data) => ({
  type: 'text' as const,
  value: data,
}));

type Param = { type: 'param'; name: string };
const identifierRE = /[a-zA-Z_$][\w$]*/;
const param: Parser<Param> = regex(new RegExp(':' + identifierRE.source)).map((data) => ({
  type: 'param' as const,
  name: data.slice(1),
}));

type Optional<Data> = { type: 'optional'; value: Array<Data> };
const optional = <Data>(parser: Parser<Data>): Parser<Optional<Data>> =>
  seq([lit('('), many0(parser), lit(')')]).map((data) => ({
    type: 'optional' as const,
    value: data[1],
  }));

const protocol = many1(choice([optional(protocolText), protocolText]));
const hostname = many1(choice([optional(choice([param, hostnameText])), param, hostnameText]));
const pathname = many1(choice([optional(choice([param, hostnameText])), param, pathnameText]));
const search: Parser<Text> = regex(/.*/).map((data) => ({ type: 'text' as const, value: data }));

// ProtocolHostname <- (Protocol) '://' Hostname
// Pattern <-
// | (ProtocolHostname '/') Pathname ('?' Search)
// | ProtocolHostname

const protocolHostname = seq([opt(protocol), lit('://'), hostname]).map((data) => ({
  protocol: data[0],
  hostname: data[2],
}));
export const pattern = choice([
  protocolHostname.end(),
  seq([
    opt(seq([protocolHostname, lit('/')]).map((data) => data[0])),
    pathname,
    opt(seq([lit('?'), search]).map((data) => data[1])),
  ])
    .map((data) => ({
      ...data[0],
      pathname: data[1],
      search: data[2],
    }))
    .end(),
]);
