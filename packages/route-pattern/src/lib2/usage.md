```ts
const errUnmatchedParens = (error, state) => {
  if (error.type !== 'unrecognized') return error;
  const char = state.source[state.index];
  if (char === '(' || char === ')') {
  }
};

const errMissingParamName = (error, state) => {
  if (error.type !== unrecognized) return error;
  const char = state.source[state.index];
  if (char !== ':') return error;
  return {};
};

const parseProtocol: Parse<Protocol> = many1(choice([optional(text), text]))
  .mapErr(customError.unmatchedParens)
  .done();
const parseHostname: Parse<Hostname> = many1(choice([optional(choice([param, text])), param, text]))
  .mapErr(customError.unmatchedParens)
  .mapErr(customError.missingParamName)
  .done();
const parsePathname: Parse<Pathname> = many1(choice([optional(choice([param, text])), param, text]))
  .mapErr(customError.unmatchedParens)
  .mapErr(customError.missingParamName)
  .done();
const parseSearch: Parse<Search> = regex(/.*/)
  .map((data) => ({ type: 'text' as const, value: data }))
  .done();
```
