import { describe, it } from 'node:test';
import { performance } from 'node:perf_hooks';

import { parseHttpStream as parseHttpStreamWASM, getLLHttpInstance, HttpParser } from './http-parser.ts';
import { parseHttpStream as parseHttpStreamJS, HttpParserJS } from './http-parser-js.ts';

// Select parser based on environment variable
const parseHttpStream = process.env.PARSER === 'JS' ? parseHttpStreamJS : parseHttpStreamWASM;
const ParserClass = process.env.PARSER === 'JS' ? HttpParserJS : HttpParser;
const parserName = process.env.PARSER === 'JS' ? 'JS Parser' : 'WASM Parser';

function createTestStream(data: string | Uint8Array): ReadableStream<Uint8Array> {
  let bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function benchmarkParser(
  name: string,
  parseFunc: (stream: ReadableStream<Uint8Array>, options: any) => Promise<void>,
  iterations: number = 1000,
) {
  // Test data
  let simpleRequest =
    'GET /api/test HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Benchmark\r\n\r\n';
  let complexRequest =
    'POST /api/data HTTP/1.1\r\n' +
    'Host: example.com\r\n' +
    'Content-Type: application/json\r\n' +
    'Content-Length: 100\r\n' +
    'Authorization: Bearer token123\r\n' +
    'X-Custom-Header-1: value1\r\n' +
    'X-Custom-Header-2: value2\r\n' +
    'X-Custom-Header-3: value3\r\n' +
    '\r\n' +
    '{"test":true,"data":"x".repeat(50)}'.padEnd(100, ' ');

  // Warm up
  for (let i = 0; i < 10; i++) {
    await parseFunc(createTestStream(simpleRequest), {
      onRequest() {},
      onBody() {},
      onComplete() {},
      onError() {},
    });
  }

  // Benchmark simple requests
  let simpleStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await parseFunc(createTestStream(simpleRequest), {
      onRequest() {},
      onBody() {},
      onComplete() {},
      onError() {},
    });
  }
  let simpleTime = performance.now() - simpleStart;

  // Benchmark complex requests
  let complexStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await parseFunc(createTestStream(complexRequest), {
      onRequest() {},
      onBody() {},
      onComplete() {},
      onError() {},
    });
  }
  let complexTime = performance.now() - complexStart;

  console.log(`\n--- ${name} Benchmark Results ---`);
  console.log(
    `Simple requests: ${(iterations / (simpleTime / 1000)).toFixed(0)} req/s (${simpleTime.toFixed(2)}ms total)`,
  );
  console.log(
    `Complex requests: ${(iterations / (complexTime / 1000)).toFixed(0)} req/s (${complexTime.toFixed(2)}ms total)`,
  );
  console.log(`Avg simple: ${(simpleTime / iterations).toFixed(3)}ms/req`);
  console.log(`Avg complex: ${(complexTime / iterations).toFixed(3)}ms/req`);

  return { simpleTime, complexTime };
}

async function benchmarkDirect(name: string, ParserClass: any, iterations: number = 1000) {
  let simpleRequest =
    'GET /api/test HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Benchmark\r\n\r\n';
  let complexRequest =
    'POST /api/data HTTP/1.1\r\n' +
    'Host: example.com\r\n' +
    'Content-Type: application/json\r\n' +
    'Content-Length: 100\r\n' +
    'Authorization: Bearer token123\r\n' +
    'X-Custom-Header-1: value1\r\n' +
    'X-Custom-Header-2: value2\r\n' +
    'X-Custom-Header-3: value3\r\n' +
    '\r\n' +
    '{"test":true,"data":"x".repeat(50)}'.padEnd(100, ' ');

  let simpleBytes = new TextEncoder().encode(simpleRequest);
  let complexBytes = new TextEncoder().encode(complexRequest);

  // Setup for WASM parser if needed
  let llhttp = null;
  if (ParserClass === HttpParser) {
    llhttp = await getLLHttpInstance();
  }

  // Warm up
  for (let i = 0; i < 10; i++) {
    let parser = llhttp ? new ParserClass(llhttp, {}) : new ParserClass({});
    parser.write(simpleBytes);
    parser.destroy();
  }

  // Benchmark simple requests
  let simpleStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    let parser = llhttp
      ? new ParserClass(llhttp, {
          onRequest() {},
          onBody() {},
          onComplete() {},
        })
      : new ParserClass({
          onRequest() {},
          onBody() {},
          onComplete() {},
        });
    parser.write(simpleBytes);
    parser.destroy();
  }
  let simpleTime = performance.now() - simpleStart;

  // Benchmark complex requests
  let complexStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    let parser = llhttp
      ? new ParserClass(llhttp, {
          onRequest() {},
          onBody() {},
          onComplete() {},
        })
      : new ParserClass({
          onRequest() {},
          onBody() {},
          onComplete() {},
        });
    parser.write(complexBytes);
    parser.destroy();
  }
  let complexTime = performance.now() - complexStart;

  console.log(`\n--- ${name} Direct API Benchmark ---`);
  console.log(`Simple requests: ${(iterations / (simpleTime / 1000)).toFixed(0)} req/s`);
  console.log(`Complex requests: ${(iterations / (complexTime / 1000)).toFixed(0)} req/s`);
  console.log(`Avg simple: ${(simpleTime / iterations).toFixed(3)}ms/req`);
  console.log(`Avg complex: ${(complexTime / iterations).toFixed(3)}ms/req`);

  return { simpleTime, complexTime };
}

describe('HTTP Parser Benchmarks', () => {
  it(`benchmarks ${parserName} performance`, async () => {
    console.log(`\n========== ${parserName.toUpperCase()} BENCHMARKS ==========`);
    console.log('\n--- STREAM API BENCHMARKS ---');

    let streamResults = await benchmarkParser(`${parserName} (parseHttpStream)`, parseHttpStream, 1000);

    console.log('\n--- DIRECT API BENCHMARKS ---');

    let directResults = await benchmarkDirect(`${parserName}`, ParserClass, 5000);

    // Memory usage
    console.log('\n========== MEMORY USAGE ==========');

    // Create many parsers and measure memory
    let memBefore = process.memoryUsage().heapUsed;
    let parsers = [];

    // Setup for WASM parser if needed
    let llhttp = null;
    if (ParserClass === HttpParser) {
      llhttp = await getLLHttpInstance();
    }

    for (let i = 0; i < 1000; i++) {
      if (llhttp) {
        parsers.push(new ParserClass(llhttp, {}));
      } else {
        parsers.push(new ParserClass({}));
      }
    }
    let memUsed = process.memoryUsage().heapUsed - memBefore;

    console.log(`${parserName}: ${(memUsed / 1024 / 1024).toFixed(2)} MB for 1000 instances`);
    console.log(`Average per instance: ${(memUsed / 1000 / 1024).toFixed(2)} KB`);

    // Clean up
    for (let parser of parsers) {
      parser.destroy();
    }
  });

  it('tests edge cases and error handling', async () => {
    console.log('\n========== EDGE CASE PERFORMANCE ==========');

    let edgeCases = [
      'GET\r\n\r\n', // Missing URL and version
      'GET /test HTTP/1.1\r\n\r\n', // No headers
      'GET /test HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n', // Chunked
      'GET /test HTTP/1.1\r\n' + 'X-Header: ' + 'a'.repeat(1000) + '\r\n\r\n', // Large header
    ];

    for (let testCase of edgeCases) {
      console.log(`\nTesting: ${testCase.substring(0, 50)}...`);

      let success = false;
      let start = performance.now();
      try {
        await parseHttpStream(createTestStream(testCase), {
          onRequest() {
            success = true;
          },
          onError() {},
        });
      } catch (e) {}
      let time = performance.now() - start;

      console.log(`${parserName}: ${success ? 'success' : 'failed'} in ${time.toFixed(2)}ms`);
    }
  });
});
