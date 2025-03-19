import { choice, lit, many0, many1, regex, seq, type Parser } from './parser.lib.ts';
import { err, ok, type Result } from './result.ts';
import { split } from './split.ts';

type Text = { type: 'text'; value: string };
const text: Parser<Text> = regex(/[^():]+/).map((data) => ({
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

type Parse<Data, E = string> = (source: string) => Result<Data, E>;
type Protocol = Array<Text | Optional<Text>>;
type Hostname = Array<Text | Param | Optional<Text | Param>>;
type Pathname = Array<Text | Param | Optional<Text | Param>>;
type Search = Text;

const parseProtocol: Parse<Protocol> = many1(choice([optional(text), text])).done();
const parseHostname: Parse<Hostname> = many1(
  choice([optional(choice([param, text])), param, text]),
).done();
const parsePathname: Parse<Pathname> = many1(
  choice([optional(choice([param, text])), param, text]),
).done();
const parseSearch: Parse<Search> = regex(/.*/)
  .map((data) => ({ type: 'text' as const, value: data }))
  .done();

type Parsed = {
  protocol?: Protocol;
  hostname?: Hostname;
  pathname?: Pathname;
  search?: Search;
};
type Errs = { [K in keyof Parsed]: string };

export const parse: Parse<Parsed, Errs> = (source: string) => {
  const parts = split(source);

  const values: Record<string, unknown> = {};
  const errs: Record<string, unknown> = {};

  const results = {
    protocol: parts.protocol !== undefined ? parseProtocol(parts.protocol) : undefined,
    hostname: parts.hostname !== undefined ? parseHostname(parts.hostname) : undefined,
    pathname: parts.pathname !== undefined ? parsePathname(parts.pathname) : undefined,
    search: parts.search !== undefined ? parseSearch(parts.search) : undefined,
  };

  for (const [name, result] of Object.entries(results)) {
    if (result === undefined) continue;
    if (result.ok) {
      values[name] = result.value;
    } else {
      errs[name] = result.error;
    }
  }

  if (Object.keys(errs).length > 0) return err(errs);
  return ok(values);
};
