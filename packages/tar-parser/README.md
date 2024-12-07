# tar-parser

`tar-parser` is a fast, efficient parser for [tar archives](<https://en.wikipedia.org/wiki/Tar_(computing)>). It can be used in any JavaScript environment (not just Node.js).

## Features

- Runs anywhere JavaScript runs
- Built on the standard [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API), so it's composable with `fetch()` streams
- Supports POSIX, GNU, PAX tar formats, and old GNU sparse files
- Memory efficient and does not buffer anything in normal usage
- 0 dependencies

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/tar-parser
```

## Usage

The main parser interface is the `parseTar(archive, handler)` function:

```ts
import { parseTar } from '@mjackson/tar-parser';

let response = await fetch(
  'https://github.com/mjackson/remix-the-web/archive/refs/heads/main.tar.gz',
);

await parseTar(response.body.pipeThrough(new DecompressionStream('gzip')), (entry) => {
  console.log(entry.name, entry.size);
});
```

### Handling Different Filename Encodings

If you're parsing an archive with filename encodings other than UTF-8, use the `filenameEncoding` option:

```ts
let response = await fetch(/* ... */);

await parseTar(response.body, { filenameEncoding: 'latin1' }, (entry) => {
  console.log(entry.name, entry.size);
});
```

### Working with Sparse Files

For sparse files, tar-parser reconstructs the file by default, filling in zeroed regions as indicated by the sparse map:

```ts
await parseTar(response.body, async (entry) => {
  if (entry.header.type === 'sparse') {
    // Fully reconstructed sparse file
    let reconstructedData = await entry.bytes();
    console.log(entry.name, reconstructedData.length);
  }
});
```

If you prefer the raw data chunks as they appear in the archive (without reconstructing zeros), you can call `entry.bytes({ raw: true })`:

```ts
await parseTar(response.body, async (entry) => {
  if (entry.header.type === 'sparse') {
    // Raw archived data segments only, no sparse reconstruction
    let rawData = await entry.bytes({ raw: true });
    console.log(entry.name, rawData.length);
  }
});
```

This allows you to save memory by only working with blocks that actually contain data.

## Benchmark

`tar-parser` performs on par with other popular tar parsing libraries on Node.js.

```
> @mjackson/tar-parser@0.0.0 bench /Users/michael/Projects/remix-the-web/packages/tar-parser
> node --experimental-strip-types --disable-warning=ExperimentalWarning ./bench/runner.ts

Platform: Darwin (24.0.0)
CPU: Apple M1 Pro
Date: 12/6/2024, 11:00:55 AM
Node.js v22.8.0
┌────────────┬────────────────────┐
│ (index)    │ lodash npm package │
├────────────┼────────────────────┤
│ tar-parser │ '6.23 ms ± 0.58'   │
│ tar-stream │ '6.72 ms ± 2.24'   │
│ node-tar   │ '6.49 ms ± 0.44'   │
└────────────┴────────────────────┘
```

## Credits

`tar-parser` is based on the excellent [tar-stream package](https://www.npmjs.com/package/tar-stream) (MIT license) and adopts the same core parsing algorithm, utility functions, and many test cases.

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
