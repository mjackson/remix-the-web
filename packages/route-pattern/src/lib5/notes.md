## rules

Optionals: `(<stuff>)`
Params: `:<identifier>`

Examples: `http(s)://(:sub.)remix.run/products/:id(/v:version)`

patterns:
/hello/:world/tim
/hello/:world/brooks
/hello/:world/:mark
/:blah/:foo

url:
/hello/earth/tim
/hello/earth/:mark=tim

Goal:

- grab a bunch of patterns, stick em in a tree, match against them using tree algos

## benefits

- "Longest static prefix", no arbitrary weights
- Generate _all_ matches, but can short-circuit on first/best match if you want
  - Useful in rare SEO case where you don't want "longest static prefix"
- Reports route conflicts, never encodes conflicts
- Params: one or many in a single segment!
- Optionals: Can be part of a segment, a whole segment, or even multiple segments!
- Params allowed in hostname (not just pathname)
- Optionals allowed in protocol and hostname (not just pathname)

## perf

- For normal cases, scales with size of input, not number of routes
- Dynamic children sorted by partial static lengths
- Enhanced depth-first search with minimal memory overhead and no processing of nodes outside current branch!

## correctness

- Throws when param names are missing
- Throws when parens for optionals are unbalanced
- Throws when optionals are nested
- Throws when routes conflict
