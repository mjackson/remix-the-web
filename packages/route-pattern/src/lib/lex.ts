import type { Token } from './token';

type Lexer = (source: string) => Generator<Token>;
type Sublexer = (source: string, index: number) => Token | null;

function createLexer(sublexers: Array<Sublexer>): Lexer {
  return function* (source) {
    let buffer = '';

    let index = 0;
    while (index < source.length) {
      let token: Token | null = null;
      for (const sublexer of sublexers) {
        token = sublexer(source, index);
        if (token) break;
      }

      if (token) {
        if (buffer) {
          yield { type: 'text', value: buffer, span: [index - buffer.length, buffer.length] };
          buffer = '';
        }
        yield token;
        index += token.span[1];
      } else {
        buffer += source[index];
        index += 1;
      }
    }

    if (buffer) {
      yield { type: 'text', value: buffer, span: [source.length - buffer.length, buffer.length] };
    }
  };
}

const paren: Sublexer = (source, index) => {
  const char = source[index];
  if (char === '(' || char === ')') {
    return { type: char, span: [index, 1] };
  }
  return null;
};

const identifierRE = /[a-zA-Z_$][a-zA-Z_$0-9]*/;

const paramRE = new RegExp('^:(' + identifierRE.source + ')?');
const param: Sublexer = (source, index) => {
  const match = paramRE.exec(source.slice(index));
  if (!match) return null;
  const name = match[1];
  return { type: 'param', name, span: [index, match[0].length] };
};

const globRE = new RegExp('^\\*(' + identifierRE.source + ')?');
const glob: Sublexer = (source, index) => {
  const match = globRE.exec(source.slice(index));
  if (!match) return null;
  const name = match[1];
  return { type: 'glob', name, span: [index, match[0].length] };
};

export const lexProtocol: Lexer = createLexer([paren]);
export const lexHostname: Lexer = createLexer([param, glob, paren]);
export const lexPathname: Lexer = createLexer([param, glob, paren]);
