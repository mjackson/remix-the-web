/**
 * Expands an pattern with optionals into multiple patterns without optionals.
 * Does not support nested optionals.
 *
 * For example:
 *
 * ```ts
 * expandOptionals("the (quick) brown fox (jumped)")
 * // -> [
 * //  "the  brown  fox",
 * //  "the  brown fox jumped",
 * //  "the quick brown fox",
 * //  "the quick brown fox jumped",
 * // ]
 * ```
 *
 * @throws {ParseError} when parentheses are nested or unmatched
 */
export function* expandOptionals(rawPattern: string): Generator<string> {
  const parens = matchParens(rawPattern);

  // Iterate through all possible combinations of optionals
  // by treating a number (`state`) as a binary number mapping to
  // true/false values
  //
  // For example, with 3 optionals you can use 3 bits to represent the 2^3 = possible 8 combinations:
  //
  // | number | binary | booleans |
  // | ------ | ------ | -------- |
  // | 0      |    000 |    f f f |
  // | 1      |    001 |    f f t |
  // | 2      |    010 |    f t f |
  // | 3      |    011 |    f t t |
  // | 4      |    100 |    t f f |
  // | 5      |    101 |    t f t |
  // | 6      |    110 |    t t f |
  // | 7      |    111 |    t t t |

  const max = 2 ** parens.length - 1;
  for (let state = 0; state <= max; state++) {
    let pattern = '';

    let current = 0;
    parens.forEach(([open, close], i) => {
      pattern += rawPattern.slice(current, open);

      // Extract i-th bit from `state`
      const shouldUseOptional = (1 << i) & state;
      if (shouldUseOptional) {
        pattern += rawPattern.slice(open + 1, close);
      }

      current = close + 1;
    });

    pattern += rawPattern.slice(current);
    yield pattern;
  }
}

type ParseErrorType = 'unmatched-parenthesis' | 'nested-parenthesis';
export class ParseError extends Error {
  type: ParseErrorType;
  index: number;

  constructor(type: ParseErrorType, index: number) {
    super(`${type} at index: ${index}`);
    this.name = 'ParseError';

    this.type = type;
    this.index = index;
  }
}

/**
 * Identifies the indices for pairs of matching parentheses.
 * Intentionally does not support nested parentheses.
 *
 * For example:
 *
 * ```ts
 * matchParens("a(b)c(d)e")
 * //            ^ ^ ^ ^
 * //           0123456789
 * // -> [[1,3], [5,7]]
 * ```
 *
 * @throws {ParseError} when parentheses are nested or unmatched
 */
function matchParens(rawPattern: string): Array<[number, number]> {
  const parens: Array<[number, number]> = [];

  const stack: Array<number> = [];
  for (let i = 0; i < rawPattern.length; i++) {
    const char = rawPattern[i];

    if (char === '(') {
      if (stack.length > 0) throw new ParseError('nested-parenthesis', i);
      stack.push(i);
      continue;
    }

    if (char === ')') {
      const open = stack.pop();
      if (open === undefined) throw new ParseError('unmatched-parenthesis', i);
      parens.push([open, i]);
      continue;
    }
  }
  if (stack.length > 0) {
    throw new ParseError('unmatched-parenthesis', stack.at(-1)!);
  }
  return parens;
}
