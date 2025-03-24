function* tokenize(
  source: string,
  tokenizers: Array<Tokenizer>,
  onUnknown?: () => void,
): Generator<Token> {
  let unknown = '';

  let i = 0;
  iter: while (i < source.length) {
    for (const tokenizer of tokenizers) {
      const token = tokenizer({ source, index: i });
      if (!token) continue;
      if (unknown.length > 0) {
        yield { index: i - unknown.length, length: unknown.length, type: '?' };
      }
      yield token;
      i += token.length;
      unknown = '';
      continue iter;
    }
    unknown += source[i];
    i += 1;
  }
}

type Token = { index: number; length: number } & (
  | { type: '(' | ')' }
  | { type: 'param'; name: string }
  | { type: 'text' }
  | { type: '?' }
);

type State = { source: string; index: number };

type Tokenizer = (state: State) => Token | null;

const parens: Tokenizer = ({ source, index }) => {
  const char = source[index];
  if (char === '(' || char === ')') return { index, length: 1, type: char };
  return null;
};

const identiferRE = /^[a-zA-Z_$][\w$]*/;
const param: Tokenizer = ({ source, index }) => {
  const char = source[index];
  if (char !== ':') return null;
  const match = identiferRE.exec(source.slice(index));
  if (!match) {
    throw new Error('Missing param name'); // TODO custom error (source, index)
  }
  const name = match[0];
  return { index, length: 1 + name.length, type: 'param', name };
};

const x = tokenize('protocol', [parens]);
const y = tokenize('hostname', [parens, param]);
const z = tokenize('pathname', [parens, param]);
