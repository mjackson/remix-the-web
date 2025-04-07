## Pattern

### Parameters

Parameters are denoted by a leading `:` and can appear in the `hostname` and `pathname`.

```txt
https://:sub.remix.run/products/:id
```

- Parameter name follows the `:` and must be a valid JS identifier

### Optionals

Optional parts of a pattern are denoted with `()` and can appear in the `protocol`, `hostname`, and `pathname`.

```txt
http(s)://(:sub.)remix.run/products/:id
```

yes:

- parameters can be inside optionals
- optionals can span multiple segments
- multiple optionals can appear in each part

no:

- not unmatched
- not across parts
- not nested

## Variant

A variant of a pattern is a view of that pattern where each optional has been chosen to be included or excluded.

For example, this pattern:

```txt
http(s)://(:sub.)remix.run/products(/:id)
```

has 3 optionals, meaning it has 2^3 = 8 variants:

| `(s)` | `(:sub)` | `(/:id)` | variant                             |
| ----- | -------- | -------- | ----------------------------------- |
| ❌    | ❌       | ❌       | http://remix.run/products           |
| ❌    | ❌       | ✅       | http://remix.run/products/:id       |
| ❌    | ✅       | ❌       | http://:sub.remix.run/products      |
| ❌    | ✅       | ✅       | http://:sub.remix.run/products/:id  |
| ✅    | ❌       | ❌       | https://remix.run/products          |
| ✅    | ❌       | ✅       | https://remix.run/products/:id      |
| ✅    | ✅       | ❌       | https://:sub.remix.run/products     |
| ✅    | ✅       | ✅       | https://:sub.remix.run/products/:id |

## Matching

- correctness: no conflicts
- correctness: "best" match first
- perf/scale: `O(input)`

```txt
1. http://remix.run/home
2. http://remix.run/admin/:user
3. http://remix.run/admin/:id/preferences
4. http://remix.run/(:lang/)blog/:slug(/v:version)
```

```txt
protocol {http}
  hostname {remix}
    hostname {run}
      pathname {home}            -> (1)
      pathname {admin}
        pathname [:]             -> (2) [user]
          pathname {preferences} -> (3) [id]
      pathname {blog}
        pathname [:]             -> (4a) [_, slug, _]
          pathname [v:]          -> (4b) [_, slug, version]
      pathname [:]
        pathname {blog}
          pathname [:]           -> (4c) [lang, slug, _]
            pathname [v:]        -> (4d) [lang, slug, version]
```

In this case the variants for (4) need to know how to map back their matched param values to the _original pattern_'s params.

When producing variants for a given pattern, we'll compute:

- the _pattern_'s ordered param names (`paramNames`)
- the param indices of the variant's params in terms of the pattern's param names (`paramIndices`)

Then during a match, we can accumulate an array of param values (`paramValues`).
That way, we can use the `paramIndices` to map the `paramValues` back to their `paramNames` while preserving strict ordering
and also being careful to include `undefined` for params that are not included in the variant.
