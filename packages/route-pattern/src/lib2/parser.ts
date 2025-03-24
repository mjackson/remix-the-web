import { choice, lit, many0, many1, regex, seq, type Parser } from './parser.lib.ts';
import { type Result } from './result.ts';
import { split } from './split.ts';

type ParseErrorType = 'Unmatched parenthesis' | 'Missing param name';
export class ParseError extends Error {
  type: ParseErrorType;
  index: number;

  constructor(type: ParseErrorType, state: { source: string; index: number }) {
    const message = [
      'Error parsing route pattern:',
      '',
      state.source,
      ' '.repeat(state.index) + '^' + type,
    ].join('\n');
    super(message);
    this.type = type;
    this.index = state.index;
  }
}

type Text = { type: 'text'; value: string };
const text: Parser<Text> = regex(/[^():]+/).map((data) => ({
  type: 'text' as const,
  value: data,
}));

type Param = { type: 'param'; name: string };
const identifierRE = /[a-zA-Z_$][\w$]*/;
const param: Parser<Param> = choice([
  seq([lit(':'), regex(identifierRE)]).map((data) => ({
    type: 'param' as const,
    name: data[1],
  })),
  lit(':').map((_, state) => {
    throw new ParseError('Missing param name', { ...state, index: state.index - 1 });
  }),
]);

type Optional<Data> = { type: 'optional'; value: Array<Data> };
const optional = <Data>(parser: Parser<Data>): Parser<Optional<Data>> =>
  choice([
    seq([lit('('), many0(parser), lit(')')]).map((data) => ({
      type: 'optional' as const,
      value: data[1],
    })),
    lit('(').map((_, state) => {
      throw new ParseError('Unmatched parenthesis', { ...state, index: state.index - 1 });
    }),
    lit(')').map((_, state) => {
      throw new ParseError('Unmatched parenthesis', { ...state, index: state.index - 1 });
    }),
  ]);

// TODO: this type belongs in lib; requires better name for `done`
type Parse<Data> = (source: string) => Result<Data>;

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

export const parse = (source: string): Parsed => {
  const parts = split(source);

  const values: Record<string, unknown> = {};

  const results = {
    protocol: parts.protocol !== undefined ? parseProtocol(parts.protocol) : undefined,
    hostname: parts.hostname !== undefined ? parseHostname(parts.hostname) : undefined,
    pathname: parts.pathname !== undefined ? parsePathname(parts.pathname) : undefined,
    search: parts.search !== undefined ? parseSearch(parts.search) : undefined,
  };

  for (const [name, result] of Object.entries(results)) {
    if (result === undefined) continue;
    if (!result.ok) {
      throw new Error(result.error);
    }
    values[name] = result.value;
  }

  return values;
};
