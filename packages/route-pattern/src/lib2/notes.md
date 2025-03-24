##

## thoughts...

tokenize _before_ combine?

## TODO

### parsing

- [x] split parts by first `://` -> first `/` -> first `?`

- [ ] error tests
  - [ ] unbalanced params in each part
  - [ ] unbalanced within parts even when balanced as a whole
  - [ ] protocol: no `?`, `/`, `:` chars allowed
  - [ ] hostname + pathname: no `:` without param
- [ ] rename `done`

- [] later: escape? `\\:`, `\\(`, `\\)`

### match

to regex + paramNames
