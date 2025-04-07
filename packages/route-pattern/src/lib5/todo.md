## TODO

```ts
const pattern1 = 'http://remix.run/blah?a&b';
const pattern2 = 'http://remix.run/blah?b&c';

// http -> run -> remix -> blah (match!!!)
// constraint a&b -> routeA
// constraint b&c -> routeB

const url = 'http://remix.run/blah?a&b&c';

const matcher = createMatcher([pattern1, pattern2]);
matcher.match();
matcher.test();
```

```ts
const pattern1 = 'http://remix.com/peter';
const pattern2 = 'https://remix.run/miguel?b&c';
const pattern3 = '://unpkg.com/docs';
const pattern4 = 'blog/:slug';

// pattern2 overrides pattern1
pattern1.join(pattern2); // -> https://remix.run/peter/miguel?b&c // union the search param

pattern1.join(pattern3); // -> https://remix.run/miguel?b&c
pattern1.join(pattern4); // -> https://remix.run/miguel?b&c

mount('http://remix.run/blog', () => {
  route('https://remix.com/:id');
});

mount('/blog', () => {
  route('/:id');
});
```

- [ ] API

  - [ ] globs
  - [ ] search params
  - [x] RoutePattern.parse
  - [ ] RoutePattern.source (cached)
  - [ ] RoutePattern.join
  - [x] createMatcher.{match,test}

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

```ts
const pattern = RoutePattern.parse('...');
pattern.source;

// join???

const match = createMatcher([...])
```
