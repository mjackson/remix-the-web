```ts
const errs = {
  unmatchedParen: (parsedIndex, parenIndex) => {
    const message = 'Unmatched paren';
    return err(new ParseError());
  },
  nestedParen: (parsedIndex) => {
    const message = 'Unmatched paren';
    return err(new ParseError());
  },
  missingParamName: (parsedIndex) => {
    const message = 'Unmatched paren';
    return err(new ParseError());
  },
  expected,
};

errs.unmatchedParen();
errs.nestedParen();
errs.missingParamName();
errs.expected();
```

if we want typesafety for `type` in `ParseError` then we can use interface declaration merging!
but seems like overkill for now
