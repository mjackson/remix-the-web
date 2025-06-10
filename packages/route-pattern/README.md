# Route Pattern

Route patterns are strings that describe a URL.
Patterns always match against complete URLs, but in our examples we show only the relevant part of the URL for brevity.

## Pathname

The most common use-case for route patterns is to match pathnames, so let's start with just the pathname.

### Params

Params capture dynamic values and are written as `:` followed by a param name:

```ts
'products/:id'
// /products/winter-jacket → { id: 'winter-jacket' }

'blog/:year/:month/:slug'
// /blog/2024/march/hello-world → { year: '2024', month: 'march', slug: 'hello-world' }
```

Params can be mixed with static text in the same segment:

```ts
'users/@:id'
// /users/@sarah → { id: 'sarah' }

':filename.pdf'
// /report.pdf → { filename: 'report' }

'sku-:category-:id'
// /sku-shoes-12345 → { category: 'shoes', id: '12345' }

'v:major.:minor-:channel'
// /v2.1-beta → { major: '2', minor: '1', channel: 'beta' }
```

Param names must be valid JS identifiers and they must be unique:

```ts
// ✅ Good - unique param names
'blog/:year/:month/:slug'

// ❌ Bad - invalid param name
'products/:123'

// ❌ Bad - duplicate param name
'users/:id/posts/:id'
```

### Glob

Globs capture "everything after this point" using `*`. Unlike params, globs must take up an entire segment and can only appear as the last segment:

```ts
// ✅ Good - entire last segment
'docs/*path'
// /docs/getting-started/quickstart → { path: 'getting-started/quickstart' }

// ✅ Good - Static text and params before a glob
'users/:id/files/*filepath'
// /users/sarah/files/projects/readme.md → { id: 'sarah', filepath: 'projects/readme.md' }

// ❌ Bad - mixed with static text
'files/prefix-*path'

// ❌ Bad - not last segment  
'files/*path/metadata'
```

Globs and params share the same namespace, so names must be unique:

```ts
// ✅ Good - unique names
'users/:userId/files/*filepath'

// ❌ Bad - duplicate name: 'path'
'users/:path/files/*path'
```

### Optionals

You can mark any part of a pathname pattern as optional by enclosing it in parentheses `()`. Optionals can span any characters and contain static text, params, or globs:

```ts
'products/:id(/edit)'
// /products/winter-jacket → { id: 'winter-jacket' }
// /products/winter-jacket/edit → { id: 'winter-jacket' }

'download/:filename(.pdf)'
// /download/report → { filename: 'report' }
// /download/report.pdf → { filename: 'report' }

'api(/v:version)/users'
// /api/users → {}
// /api/v2/users → { version: '2' }

'users/:id(/settings/:section)(/edit)'
// /users/sarah → { id: 'sarah' }
// /users/sarah/settings/profile → { id: 'sarah', section: 'profile' }
// /users/sarah/settings/profile/edit → { id: 'sarah', section: 'profile' }

'docs/:category/*path(/index)'
// /docs/guides/getting-started/quickstart → { category: 'guides', path: 'getting-started/quickstart' }
// /docs/guides/getting-started/quickstart/index → { category: 'guides', path: 'getting-started/quickstart' }
```

A _variant_ is a particular choice of which optionals to include.
You can think of `()` as a shorthand for writing out all the variant by hand:

```ts
'api(/v:version)/users/:id(/:action)(/.*format)'
// Creates 8 variants:
// 1. `api/users/:id`
// 2. `api/users/:id/:action`
// 3. `api/users/:id.*format`
// 4. `api/users/:id/:action.*format`
// 5. `api/v:version/users/:id`
// 6. `api/v:version/users/:id/:action`
// 7. `api/v:version/users/:id.*format`
// 8. `api/v:version/users/:id/:action.*format`

'docs/*path(/index)(.html)'
// Creates 4 variants:
// 1. `docs/*path`
// 2. `docs/*path/index`
// 3. `docs/*path.html`
// 4. `docs/*path/index.html`
```

As you can see, each optional **doubles** the number of variants.

When using optionals, param and glob names must be unambiguous across all variants:

```ts
// ✅ Good - unambiguous across variants
'users/:id(/settings)'

// ❌ Bad - ambiguous param names across variants
'files/:name(Extension)'
// variants:
// 1. `files/:name` - param name is 'name'
// 2. `files/:nameExtension` - param name becomes 'nameExtension'!

'products/(:category)Items'
// variants:
// 1. `products/Items` - no params
// 2. `products/:categoryItems` - param name is 'categoryItems', not 'category'!

// ✅ Good - use separators to avoid ambiguity
'products/(:category-)items'
// variants:
// 1. `products/items` - no params
// 2. `products/:category-items` - param name is clearly 'category'
```

## Hostname

Hostname patterns are similarly to pathname patterns, but with a few key differences.
Notably, hostname patterns must start with `://` to distinguish them from pathname patterns and globs can only be the entire leftmost segment of a hostname pattern:

```ts
'://example.com'
// example.com → {}

'://:region.api.example.com'
// us-east.api.example.com → { region: 'us-east' }

'://*tenant.example.com'
// store.example.com → { tenant: 'store' }

'://*host.:tenant.example.com'
// shop.acme.example.com → { host: 'shop', tenant: 'acme' }

'://(www.):subdomain.example.com'
// store.example.com → { subdomain: 'store' }
// www.store.example.com → { subdomain: 'store' }

// ✅ Good - glob leftmost
'://*subdomain.example.com'

// ❌ Bad - glob not leftmost
'://example.*domain.com'
```

**Important:** All params and globs across the entire pattern share the same namespace.
So you cannot have duplicate names anywhere in the pattern:

```ts
// ❌ Bad - param name conflict across parts
'://:region.api.example.com/users/:region'

// ❌ Bad - glob name conflict with param
'://:tenant.example.com/files/*tenant'

// ❌ Bad - cannot have globs in both hostname and pathname with same name
'://*data.example.com/files/*data'

// ✅ Good - unique names throughout
'://:region.api.example.com/users/:userId'
'://:tenant.example.com/files/*documents'
'://*subdomain.example.com/files/*filepath'
```

## Protocol

Protocol patterns are the simplest type of pattern. They cannot contain params or globs - only static text and optionals are allowed. Any variants created by optionals must result in valid protocol names that match the pattern `/^[a-zA-Z][\w+-.]*$/`:

```ts
// ✅ Good
'http'
'https'
'ftp'

// ❌ Bad - params not allowed
'http-:version'

// ❌ Bad - globs not allowed
'http*'

// ✅ Good - optional HTTPS
'http(s)'

// ✅ Good - WebSocket variants
'ws(s)'
```

## Case Sensitivity

URL patterns are case-sensitive. `Users` and `users` are different:

```ts
'Users/:id'     // Only matches /Users/123
'users/:id'     // Only matches /users/123
```

## Combining patterns

You can combine protocol, hostname, and pathname patterns in a single URL pattern:

```ts
'/api/users/:id'
// https://example.com/api/users/123 → { id: '123' }
// http://localhost/api/users/123 → { id: '123' }

'/api(/v:version)/users/:id-:username/*files(.backup)'
// https://api.com/api/users/123-sarah/projects/readme.md → { id: '123', username: 'sarah', files: 'projects/readme.md' }
// ftp://server.com/api/v2/users/123-sarah/projects/readme.md.backup → { version: '2', id: '123', username: 'sarah', files: 'projects/readme.md' }

'://*tenant.shop.com'
// https://acme.shop.com → { tenant: 'acme' }
// https://acme.shop.com/ → { tenant: 'acme' }
// ftp://acme.shop.com → { tenant: 'acme' }

'http(s)://api.example.com'
// https://api.example.com → {}
// http://api.example.com/ → {}

'://:region.api.example.com/users/:id-:type/*data'
// https://us-west.api.example.com/users/123-admin/profile/settings.json → { region: 'us-west', id: '123', type: 'admin', data: 'profile/settings.json' }
// ws://us-west.api.example.com/users/123-admin/profile/settings.json → { region: 'us-west', id: '123', type: 'admin', data: 'profile/settings.json' }

'http(s)://*tenant.shop.com/api(/v:version)/products/:sku-:id(/reviews)/*path(.json)'
// http://acme.shop.com/api/products/shoes-12345/attachments/image.jpg → { tenant: 'acme', sku: 'shoes', id: '12345', path: 'attachments/image.jpg' }
// https://acme.shop.com/api/v2/products/shoes-12345/reviews/detailed/analysis.json → { tenant: 'acme', version: '2', sku: 'shoes', id: '12345', path: 'detailed/analysis' }
```

When you omit the protocol or hostname in a pattern, they'll match any value for those parts.
The pathname is special; omitting the pathname means the pattern will only match an "empty" pathname:

```ts
// Hostname only - matches any protocol, but ONLY empty pathnames
'://*tenant.example.com'
// ✅ Matches: https://acme.example.com
// ✅ Matches: https://acme.example.com/
// ❌ Does NOT match: https://acme.example.com/api
// ❌ Does NOT match: https://acme.example.com/users/123

// Protocol + hostname - ONLY empty pathnames  
'https://api.example.com'
// ✅ Matches: https://api.example.com
// ✅ Matches: https://api.example.com/
// ❌ Does NOT match: https://api.example.com/users
```

To match any pathname, use a glob:

```ts
'://api.example.com/*path'
// https://api.example.com/users/123 -> { path: 'users/123' }
// https://api.example.com/docs/getting-started -> { path: 'docs/getting-started' }
```