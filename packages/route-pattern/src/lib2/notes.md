## Parsing / validation

- [x] split parts by first `://` -> first `/` -> first `?`

- [ ] no `:` without param (lex?)
- [ ] balanced parens in protocol, hostname, pathname
- [ ] protocol: no `?`, `/`, `:`

- [] later: escape? `\\:`, `\\(`, `\\)`

## lex:protocol

`[a-zA-Z-.+]*` -> text
`(` -> optional:open
`)` -> optional:close
-> ERROR

## lex:hostname

`(` -> optional:open
`)` -> optional:close
`:<identifier>` -> param
`:` -> ERROR
`[^():]` -> text

## lex:pathname

`(` -> optional:open
`)` -> optional:close
`:<identifier>` -> param
`:` -> ERROR
`/` -> ERROR
`[^():]` -> text

## lex:search

// TODO
