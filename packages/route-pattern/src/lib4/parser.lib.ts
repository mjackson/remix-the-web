import { err, ok, type Result } from './result.ts';

export class ParseError extends Error {
  type: string;
  index: number;
  constructor(type: string, index: number) {
    super();
    this.type = type;
    this.index = index;
    this.stack = undefined;
  }
}

export const expected = (index: number, message: string) =>
  new ParseError(`expected:${message}`, index);

type State = {
  source: string;
  index: number;
};
type ParseResult<Data> = Result<State & { data: Data }, ParseError>;
type Parse<Data> = (state: State) => ParseResult<Data>;
type GetData<T extends Parser> = T extends Parser<infer Data> ? Data : never;

export class Parser<Data = unknown> {
  #parse: Parse<Data>;
  constructor(parse: Parse<Data>) {
    this.#parse = parse;
  }

  parse(state: State) {
    return this.#parse(state);
  }

  map<NewData>(fn: (data: Data) => NewData) {
    return new Parser((state) => {
      const result = this.#parse(state);
      if (!result.ok) return result;
      return ok({ ...result.value, data: fn(result.value.data) });
    });
  }
}

export const choice = <const T extends Parser>(parsers: Array<T>): Parser<GetData<T>> => {
  return new Parser((state) => {
    let error: ParseError | undefined;
    for (const parser of parsers) {
      const result = parser.parse(state) as ParseResult<GetData<T>>;
      if (result.ok) return result;
      if (error === undefined || result.error.index > error.index) {
        error = result.error;
      }
    }
    return err(error!);
  });
};

// prettier-ignore
type Seq<T extends Array<Parser>> =
  T extends [Parser<infer Data>, ...infer Rest extends Array<Parser>] ?
    [Data, ...Seq<Rest>] :
    T
export const seq = <const T extends Array<Parser>>(parsers: T): Parser<Seq<T>> => {
  return new Parser((state) => {
    const data = [];
    for (const parser of parsers) {
      const result = parser.parse(state);
      if (!result.ok) return result;
      data.push(result.value.data);
      state = result.value;
    }
    return ok({ ...state, data: data as Seq<T> });
  });
};

export const many0 = <Data>(parser: Parser<Data>): Parser<Array<Data>> => {
  return new Parser((state) => {
    const data: Array<Data> = [];
    while (true) {
      const result = parser.parse(state);
      if (!result.ok) break;
      data.push(result.value.data);
      state = result.value;
    }
    return ok({ ...state, data });
  });
};

export const lit = <Literal extends string>(literal: Literal): Parser<Literal> => {
  return new Parser(({ source, index }) => {
    if (!source.slice(index).startsWith(literal)) {
      return err(expected(index, `literal '${literal}'`));
    }
    return ok({ source, index: index + literal.length, data: literal });
  });
};

export const regex = (regexp: RegExp): Parser<string> => {
  return new Parser(({ source, index }) => {
    const match = regexp.exec(source.slice(index));
    if (!match) return err(expected(index, `regex: ${regexp.source}`));
    return ok({ source, index: index + match[0].length, data: match[0] });
  });
};

export const end = <Data>(parser: Parser<Data>): Parser<Data> => {
  return new Parser((state) => {
    const result = parser.parse(state);
    if (!result.ok) return result;
    if (result.value.index !== result.value.source.length) {
      return err(expected(result.value.index, 'eof'));
    }
    return result;
  });
};
