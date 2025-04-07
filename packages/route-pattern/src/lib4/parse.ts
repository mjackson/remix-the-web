// 'products/', :id, (, '/v', :version, )
// then for variant, we loop over this
// and use state to determine if we should emit within an optional
// and also to determine param indices to push

type Token = { span: [number, number] } & (
  | { type: '(' | ')' }
  | { type: 'param'; name: string }
  | { type: 'text'; text: string }
);

type Node = { span: [number, number] } & (
  | { type: 'param'; name: string; index: number }
  | { type: 'text'; text: string }
);

// pattern: params + optionals
// http(s) -> 'http' opt(['s']) -> 'http' opt('s')
//                               ^ assert no params, assert opt length = 1

export function variant(tokens: Array<Token>) {
  const max = 2 ^ 3; // get # optionals from initial tokenization pass
  for (let state = 0; state < max; state++) {
    let variant: Array<Token> = [];

    let inOptional = false;
    let optional = 0;
    for (const token of tokens) {
      if (token.type === '(') {
        inOptional = true;
        optional += 1;
        continue;
      }
      if (token.type === ')') {
        inOptional = false;
        continue;
      }
      const emit = !inOptional || state & (1 << optional);
      if (emit) variant.push(token);
    }
  }
}
