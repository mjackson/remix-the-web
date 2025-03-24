import { err, ok, type Result } from './result';

type Location = {
  begin: number;
  end: number;
};
type Token = {
  location: Location;
} & ({ type: '(' | ')' } | { type: 'param'; name: string } | { type: 'text' });

type Lexer = (source: string, index: number) => Result<Token> | null;

export function lex(
  lexers: Array<Lexer>,
  unrecognized: (source: string, location: Location) => Result<Token>,
) {
  return function (source: string): Result<Array<Token>> {
    const tokens: Array<Token> = [];
    let index = 0;

    let unknownBegin: number | null = null;
    while (index < source.length) {
      let token: Result<Token> | null = null;
      for (const lexer of lexers) {
        token = lexer(source, index);
        if (token) break;
      }
      if (token) {
        if (unknownBegin !== null) {
          const u = unrecognized(source, { begin: unknownBegin, end: index });
          if (!u.ok) return u;
          tokens.push(u.value);
          unknownBegin = null;
        }
        if (!token.ok) return token;
        tokens.push(token.value);
        index = token.value.location.end;
        continue;
      }
      unknownBegin ??= index;
      index += 1;
    }
    if (unknownBegin !== null) {
      const u = unrecognized(source, { begin: unknownBegin, end: index });
      if (!u.ok) return u;
      tokens.push(u.value);
    }
    return ok(tokens);
  };
}

const lexParens: Lexer = (source, index) => {
  const char = source[index];
  if (char === '(' || char === ')') {
    return ok({ type: char, location: { begin: index, end: index + 1 } });
  }
  return null;
};

const identifierRE = /\w+/; // TODO
const lexParam: Lexer = (source, index) => {
  const char = source[index];
  if (char !== ':') return null;
  const match = identifierRE.exec(source.slice(index + 1));
  if (!match) return err('missing-param-name');
  const name = match[0];
  return ok({ type: 'param', name, location: { begin: index, end: name.length + 1 } });
};

const lexProtocol = lex([lexParens], (source, location) => {
  const lexeme = source.slice(location.begin, location.end);
  if (/a/.test(lexeme)) {
    return err('invalid protocol');
  }
  return ok({ type: 'text', location });
});
const lexHostname = lex([lexParens, lexParam], (_, location) => ok({ type: 'text', location }));
const lexPathname = lex([lexParens, lexParam], (_, location) => ok({ type: 'text', location }));

const lexers = {
  protocol: lexProtocol,
  hostname: lexHostname,
  pathname: lexPathname,
};

type Optional = { type: 'optional'; option: Array<Param | Text> };
type Param = { type: 'param'; name: string };
type Text = { type: 'text'; text: string };
type Content = Optional | Param | Text;

function parse(tokens: Array<Token>): Result<Array<Content>> {
  const result: Array<Content> = [];

  let optional: Optional | null = null;
  for (const token of tokens) {
    if (token.type === '(') {
      if (optional) return err('unmatched paren');
      optional = { type: 'optional', option: [] };
      continue;
    }

    if (token.type === ')') {
      if (!optional) return err('unmatched paren');
      result.push(optional);
      optional = null;
      continue;
    }

    const node: Param | Text = token.type === 'param' ? token : { type: token.type, text: '' };
    if (optional) {
      optional.option.push(node);
    } else {
      result.push(node);
    }
  }
  return ok(result);
}

type Lexers = [protocol: Lexer, hostname: Lexer, pathname: Lexer, search: Lexer];

for (const [name, lex] of Object.entries(lexers)) {
  const tokens = lex('asdf');
  if (!tokens.ok) throw new Error();
  const ast = parse(tokens.value);
}
const tokens = lexHostname('asdf');
if (!tokens.ok) throw new Error('hostname' + tokens.error);
