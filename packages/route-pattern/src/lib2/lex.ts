// text, open, close, param

type Token = { index: number } & (
  | { type: 'text'; text: string }
  | { type: '(' }
  | { type: ')' }
  | { type: 'param'; name: string }
);

type Lexer = [RegExp, (lexeme: string, index: number) => Token];
function scan(lexers: Array<Lexer>): (source: string) => Array<Token> {
  return (source: string) => {
    const tokens: Array<Token> = [];
    let i = 0;
    while (i < source.length) {
      for (const [regexp, lex] of lexers) {
        const match = regexp.exec(source.slice(i));
        if (!match) continue;
        const lexeme = match[0];
        const token = lex(lexeme, i);
        tokens.push(token);
      }
    }
    return tokens;
  };
}

const parens: Lexer = [/^[()]/, (char, index) => ({ type: char as '(' | ')', index })];
const protocolText: Lexer = [/^[a-zA-Z-+\.]*/, (text, index) => ({ type: 'text', text, index })];

/*
 const protocol = lex([parens, protocolText])
 const hostname = lex([parens, param, text])
 const pathname = lex([parens, param, text])

## lex:protocol

`[a-zA-Z-.+]*` -> text
`(` -> optional:open
`)` -> optional:close
-> ERROR

## lex:hostname

`(` -> optional:open
`)` -> optional:close
`:<identifier>` -> param
`[^():]` -> text
-> ERROR (maybe nicer error for `:`?)

## lex:pathname

`(` -> optional:open
`)` -> optional:close
`:<identifier>` -> param
`[^():]` -> text
-> ERROR (maybe nicer error for `:`?)

## lex:search

// TODO
 */

const protocolTextRE = /[a-zA-Z-+.]+/;
export function lexProtocol(protocol: string) {
  const tokens: Array<Token> = [];
  let i = 0;
  while (i < protocol.length) {
    const char = protocol[i];

    if (char === '(' || char === ')') {
      tokens.push({ type: char, index: i });
      i += 1;
      continue;
    }

    const matchText = protocolTextRE.exec(protocol.slice(i));
    if (matchText) {
      tokens.push({ type: 'text', text: matchText[0], index: i });
    }
  }
}
