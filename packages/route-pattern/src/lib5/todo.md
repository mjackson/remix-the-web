## refactor

## TODO

- [ ] organize tests
- [ ] API

  - [x] RoutePattern.parse
  - [x] RoutePattern.source
  - [x] RoutePattern.join
  - [x] createMatcher.{match,test}
  - [ ] globs
  - [ ] search params
  - [ ] error on params in protocol

- [ ] benchmarks

  - find-my-way
  - path-to-regexp

- [ ] docs

  - [ ] benefits
    - [ ] one or many params in a single segments
    - [ ] optionals across segments
    - [ ] match protocol & hostname (not just path!) e.g. virtual hosts!
    - [ ] match search params (type narrowing -> route narrowing)
    - [ ] correctness: no route conflicts, error reporting
    - [ ] params in hostname (not just pathname)
    - [ ] optionals in protocol & hostname (not just pathname)
    - [ ] intuitive "best" match ("longest static prefix" w/ tiebreakers)
  - [ ] comparison: existing RR
  - [ ] comparison: path-to-regexp
  - [ ] comparison: UrlPattern

- [ ] blog post

  - For normal cases, scales with size of input, not number of routes
  - Dynamic children sorted by partial static lengths
  - Enhanced depth-first search with minimal memory overhead and no processing of nodes outside current branch!

```ts
const pattern = RoutePattern.parse('...');
pattern.source;

// join???

const match = createMatcher([...])
```
