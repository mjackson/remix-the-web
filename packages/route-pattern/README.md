# route-pattern

A `RoutePattern` is a pattern that is used to match URLs. You can think about it kind of like JavaScript's built-in [regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp), but specifically designed for URLs.

## Usage

In the simplest case, a route pattern may match only a URL [pathname](https://developer.mozilla.org/en-US/docs/Web/API/URL/pathname). Variable portions of the URL can be matched with a `:id`-style identifier.

```ts
import { RoutePattern } from '@mjackson/route-pattern';

let pattern = new RoutePattern('/users/:id');
let match = pattern.match('https://remix.run/users/123');
match.params; // { id: '123' }
```

All params are strings by default. Param encoding and decoding to/from custom types is supported through the `ParamCodec` interface.

```ts
import { RoutePattern, type ParamCodec } from '@mjackson/route-pattern';

const NumberCodec: ParamCodec<number> = {
  parse: (value) => Number(value),
  stringify: (value) => String(value),
};

let pattern = new RoutePattern('/users/:id', {
  params: {
    // Always treat the `id` param as a number, both when matching and generating URLs.
    id: NumberCodec,
  },
});
let match = pattern.match('https://remix.run/users/123');
match.params; // { id: 123 }
```

You can also match the URL [hostname](https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname) and (optionally) [protocol](https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol):

```ts
let pattern = new RoutePattern('https://remix.run/users/:id');

pattern.match('https://remix.run/users/123'); // match
pattern.match('https://example.com/users/123'); // no match (null)
```

You can make any portion of the pattern optional by wrapping it in parentheses:

```ts
let pattern = new RoutePattern('/users(/:id)');

pattern.match('https://remix.run/users'); // match
pattern.match('https://remix.run/users/123'); // match
pattern.match('https://remix.run/'); // no match (null)
pattern.match('https://remix.run/users/123/edit'); // no match (null)
```

Optional matching also works in the protocol and hostname, and param matching works in the hostname:

```ts
let pattern = new RoutePattern('http(s)://(:sub.)remix.run(/users/:id)');

pattern.match('https://remix.run/users/123'); // match
pattern.match('http://remix.run/users/123'); // match
pattern.match('https://www.remix.run/users/123'); // match
pattern.match('https://remix.run/'); // match
pattern.match('https://www.remix.run/'); // match
pattern.match('https://www.remix.run/users'); // no match (null)
pattern.match('https://example.com/users/123'); // no match (null)
```

Additionally, route patterns may match portions of the search/query string:

```ts
let pattern = new RoutePattern('/search?q');

let match = pattern.match('https://remix.run/search?q=hello');
match.searchParams; // { q: 'hello' }

// Additional arbitrary search parameters are allowed.
pattern.match('https://remix.run/search?q=hello&lang=en'); // match

// When specified, query parameters are required to be present in the URL. If they are not, the
// pattern will not match.
pattern.match('https://remix.run/search'); // no match (null)
```

Similar to hostname/pathname params, search params may also use custom codecs:

```ts
const StringArrayCodec: ParamCodec<string[]> = {
  parse: (value) => value.split(','),
  stringify: (value) => value.join(','),
};

let pattern = new RoutePattern('/blog?tags', {
  searchParams: {
    // Always treat the `tags` search param as an array of strings.
    tags: StringArrayCodec,
  },
});

let match = pattern.match('https://remix.run/blog?tags=javascript,react');
match.searchParams; // { tags: ['javascript', 'react'] }
```

## Generating URLs

You can generate URLs from route patterns using an "href builder". An href builder is a function that generates URLs based on a route pattern, interpolating any params and/or search params you provide.

```ts
import { createHrefBuilder } from '@mjackson/route-pattern';

let pattern = new RoutePattern('/users(/:id)/edit', {
  params: {
    id: NumberCodec,
  },
});
let href = createHrefBuilder(pattern);

href('/users/:id', { id: 123 }); // '/users/123'
href('/users/:id/edit', { id: 123 }); // '/users/123'
```

Patterns that include search params can also be generated. Search params are provided as the 3rd argument to disambiguate them from hostname/pathname params with the same name.

```ts
const SortOrderCodec: ParamCodec<'asc' | 'desc'> = {
  parse: (value) => (value === 'desc' ? 'desc' : 'asc'),
  stringify: (value) => value,
};

let pattern = new RoutePattern('/products/:id?sort', {
  searchParams: {
    sort: SortOrderCodec,
  },
});
let href = createHrefBuilder(pattern);

href('/products/:id?sort', { id: 'nike' }, { sort: 'asc' }); // '/products/nike?sort=asc'
```

You can generate URLs for many different patterns by passing an array of patterns to `createHrefBuilder`.

```ts
let patterns = [new RoutePattern('/users/:id'), new RoutePattern('/users/:id/edit')] as const;
let href = createHrefBuilder(patterns);

href('/users/:id', { id: '123' }); // '/users/123'
href('/users/:id/edit', { id: '123' }); // '/users/123/edit'
```
