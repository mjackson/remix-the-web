import { err, ok, type Result } from './result.ts';

type State = {
  source: string;
  index: number;
};
type Parsed<Data> = State & { data: Data };
type ParseResult<Data> = Result<Parsed<Data>>;
type Parse<Data> = (state: State) => ParseResult<Data>;

type GetData<T extends Parser> = T extends Parser<infer Data> ? Data : never;

export class Parser<Data = unknown> {
  #parse: Parse<Data>;

  constructor(parse: Parse<Data>) {
    this.#parse = parse;
  }

  parse(state: State): ParseResult<Data> {
    return this.#parse(state);
  }

  map<TransformedData>(fn: (data: Data) => TransformedData) {
    return new Parser((state) => {
      const result = this.#parse(state);
      if (!result.ok) return result;
      return ok({ ...result.value, data: fn(result.value.data) });
    });
  }

  done(): (source: string) => Result<Data> {
    const parser = end(this);
    return (source: string) => {
      const result = parser.parse({ source, index: 0 });
      if (!result.ok) return result;
      return ok(result.value.data);
    };
  }
}

export const choice = <T extends Parser>(parsers: Array<T>): Parser<GetData<T>> => {
  return new Parser((state) => {
    for (const parser of parsers) {
      const result = parser.parse(state) as ParseResult<GetData<T>>;
      if (result.ok) return result;
    }
    return err('TODO: choice');
  });
};

// prettier-ignore
type Seq<Parsers extends Array<Parser>> =
  Parsers extends [Parser<infer Data>, ...infer Rest extends Array<Parser>] ?
    [Data, ...Seq<Rest>] :
    Parsers

export const seq = <const T extends Array<Parser>>(parsers: T): Parser<Seq<T>> => {
  return new Parser((state) => {
    const data: Array<unknown> = [];
    for (const parser of parsers) {
      const result = parser.parse(state);
      if (!result.ok) return result;
      data.push(result.value.data);
      state = result.value;
    }
    return ok({ ...state, data: data as Seq<T> });
  });
};

export const regex = (r: RegExp): Parser<string> => {
  r = new RegExp('^' + r.source);
  return new Parser(({ source, index }) => {
    const match = r.exec(source.slice(index));
    if (!match) return err('TODO');
    return ok({
      source,
      index: index + match[0].length,
      data: match[0],
    });
  });
};

export const lit = <T extends string>(literal: T): Parser<T> => {
  return new Parser(({ source, index }) => {
    if (source.slice(index).startsWith(literal)) {
      return ok({ source, index: index + literal.length, data: literal });
    }
    return err('TODO');
  });
};

export const many0 = <Data>(parser: Parser<Data>): Parser<Array<Data>> => {
  return new Parser((state) => {
    const data: Array<Data> = [];
    while (true) {
      const result = parser.parse(state);
      if (!result.ok) break;
      state = result.value;
      data.push(result.value.data);
    }
    return ok({ ...state, data });
  });
};

export const many1 = <Data>(parser: Parser<Data>): Parser<Array<Data>> =>
  seq([parser, many0(parser)]).map((data) => [data[0], ...data[1]]);

export const end = <Data>(parser: Parser<Data>): Parser<Data> => {
  return new Parser((state) => {
    const result = parser.parse(state);
    if (!result.ok) return result;
    if (result.value.index !== result.value.source.length) return err('TODO');
    return result;
  });
};
