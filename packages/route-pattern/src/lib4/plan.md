## plan

1. tokenize
2. parse: optionals + pattern param names + param id `Array<Optional<Array<Text | Param>> | Text | Param>`
3. validate: params shouldn't have params
   a. maybe: optionals should have length 1
   b. maybe: `Array<Optional<Text> | Text>`?
4. variants : state-based visitor, push encountered param indices
5. insert into tree (segmentize)

## blah....

pattern: http(s)://(:sub.)remix.run/products/:id(/v:version)

variant:

- protocol: https
- hostname: remix.run
- pathname: products/:

- route:
  - paramIndices: [1]
  - paramNames: ['sub', 'id', 'version']

```ts
// http(s)
// -> [] ✅ no params
// (:sub.)remix.run
// -> (:.)remix.run + ['sub']
// products/:id(/v:version)
// -> products/:(/v:) + ['id', 'version']

// 'products/', :id, (, '/v', :version, )
// then for variant, we loop over this
// and use state to determine if we should emit within an optional
// and also to determine param indices to push

function parsePattern(source: string, offset: number) {
  const paramNames = [
    /*...*/
  ];

  for (let state = 0; state < max; state++) {}

  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '(') {
    }
    if (char === ')') {
    }
    i += 1;
  }
}
```
