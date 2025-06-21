```txt
Error: unbalanced parentheses

  http(s)://remix.run/products(/:id

  I found an unmatched open parenthesis in the pathname:

    products(/:id
            ^
```

```txt
Error: glob not at end of pathname

  http(s)://remix.run/products/*path(/stuff)
                               ^^^^^

  For example, I found this pathname variant:

    products/*path/stuff
             ^^^^^

  <link to docs>
```
