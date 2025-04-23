type ParseErrorType =
  | 'paren-unmatched'
  | 'paren-nested'
  | 'param-in-protocol'
  | 'param-missing-name'
  | 'glob-in-protocol'
  | 'glob-missing-name'
  | 'glob-not-at-start-of-hostname'
  | 'glob-not-at-end-of-pathname';

export class ParseError extends Error {
  type: ParseErrorType;
  span: [number, number];

  constructor(type: ParseErrorType, span: [number, number]) {
    super();
    this.type = type;
    this.span = span;
  }

  offset(index: number): ParseError {
    this.span = [index + this.span[0], index + this.span[1]];
    return this;
  }

  // todo nice error message
}
