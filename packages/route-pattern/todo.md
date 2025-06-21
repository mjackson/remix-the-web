## todo

- search params
- enums

- matching section
  - "best" match criteria

## questions

ANSWERED
- normalize pathname? GOOD
  - leading `/`? A: preference, doesn't make a functional difference.
  - trailing `/`? A: significant!
  - multi `/`? eg. `products//:id` A: significant!

ANSWERED
- omitting hostname: what about file:///usr/bin ? match any hostname? A: yep!

ANSWERED
- how to specify if `**` matches/allows `/`? GOOD
  - how to match `/a` and `/a/` since `a/**` needs the `/` there?
    - A: just make two patterns!

ANWERED: do what rails does (`*` and `:`) but allow omitted names; maybe we allow identifier literals later... but not now
- converting wildcard to param
  - change `*` to `:` (or `**` to `::`)
  - add a name
  - oh wait... what if `*` had valid JS identifier after it? do we care?
    - `/foo/*bar` -> `/foo/<:name>bar`
    - `/foo/:bar` nope


ANSWERED: do ranking later!
- maybe we generate matches in insertion order
  - but you can get all matches and sort them with our "best match" criteria if you want

```ts
const matcher = createMatcher([], { sort: 'ranked' })
let match = matcher.bestMatch(url)
```

- deal with static optionals
  - disallow? or how to reference?

```ts
"http(s)://remix.run" // pattern

// allows 1st arg to href
main: "http(s)://remix.run" -> https
httpMain: "http://remix.run"
httpsMain: "https://remix.run"

"/:file"

"/:file.{png,jpg,ts}" -> x
// /michael.png -> check the extension and do some png transforms
// /pedro.jpg

href("/:file.png", {file: "michael"})

"/modules/*/:file.ts(x)"
"/home(/about)"

href("/home(/about)", {}) => "/home/about"

/home -> x
/home/about -> x

link_to(@product)
```
