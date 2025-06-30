import { performance } from 'node:perf_hooks';
import { HttpParser, parseHttpStream, getLLHttpInstance } from '../src/http-parser.ts';

// ANSI color codes for pretty output (disabled if NO_COLOR is set)
const noColor = process.env.NO_COLOR !== undefined;
const colors = {
  reset: noColor ? '' : '\x1b[0m',
  bright: noColor ? '' : '\x1b[1m',
  dim: noColor ? '' : '\x1b[2m',
  green: noColor ? '' : '\x1b[32m',
  yellow: noColor ? '' : '\x1b[33m',
  blue: noColor ? '' : '\x1b[34m',
  red: noColor ? '' : '\x1b[31m',
  cyan: noColor ? '' : '\x1b[36m',
  magenta: noColor ? '' : '\x1b[35m',
};

// Test data
const simpleRequest = Buffer.from(
  'GET /test HTTP/1.1\r\nHost: example.com\r\nUser-Agent: test\r\n\r\n',
);

const requestWithBody = Buffer.from(
  'POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\nContent-Length: 18\r\n\r\n{"hello": "world"}',
);

const chunkedRequest = Buffer.from(
  'POST /upload HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n7\r\nMozilla\r\n9\r\nDeveloper\r\n7\r\nNetwork\r\n0\r\n\r\n',
);

const largeHeadersRequest = (() => {
  let req = 'GET /test HTTP/1.1\r\n';
  for (let i = 0; i < 50; i++) {
    req += `X-Custom-Header-${i}: This-is-a-test-value-for-header-${i}\r\n`;
  }
  req += '\r\n';
  return Buffer.from(req);
})();

const pipelinedRequests = Buffer.from(
  [
    'GET /first HTTP/1.1\r\nHost: example.com\r\n\r\n',
    'GET /second HTTP/1.1\r\nHost: example.com\r\n\r\n',
    'GET /third HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n',
  ].join(''),
);

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDuration(ms: number): string {
  if (ms < 0.001) return `${(ms * 1000000).toFixed(0)}ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  return `${ms.toFixed(2)}ms`;
}

function printHeader(title: string) {
  console.log(`\n${colors.bright}${colors.blue}=== ${title} ===${colors.reset}`);
}

function printSubHeader(title: string) {
  console.log(`\n${colors.cyan}${title}${colors.reset}`);
}

function printMetric(
  label: string,
  value: string,
  unit: string = '',
  color: string = colors.reset,
) {
  console.log(
    `${colors.dim}${label.padEnd(25)}${colors.reset} ${color}${value.padStart(12)}${colors.reset} ${colors.dim}${unit}${colors.reset}`,
  );
}

// Create a stream from buffer
function bufferToStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

// Benchmark results interface
interface BenchmarkResult {
  name: string;
  iterations: number;
  duration: number;
  ops: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

// Run a generic benchmark
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number,
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < 100; i++) {
    await fn();
  }

  const latencies: number[] = [];
  let minLatency = Infinity;
  let maxLatency = 0;

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await fn();
    const iterDuration = performance.now() - iterStart;

    latencies.push(iterDuration);
    minLatency = Math.min(minLatency, iterDuration);
    maxLatency = Math.max(maxLatency, iterDuration);
  }

  const duration = performance.now() - start;
  const ops = (iterations / duration) * 1000; // ops per second
  const avgLatency = duration / iterations;

  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

  return {
    name,
    iterations,
    duration,
    ops,
    avgLatency,
    minLatency,
    maxLatency,
    p50Latency,
    p95Latency,
    p99Latency,
  };
}

// Benchmark the stream API
async function benchmarkStreamAPI() {
  printHeader('Stream API Performance Benchmark');
  console.log(`${colors.dim}Testing parseHttpStream() with various request types${colors.reset}`);

  const tests = [
    { name: 'Simple GET Request', data: simpleRequest, iterations: 50000 },
    { name: 'POST with Body', data: requestWithBody, iterations: 30000 },
    { name: 'Chunked Transfer', data: chunkedRequest, iterations: 20000 },
    { name: 'Large Headers', data: largeHeadersRequest, iterations: 10000 },
    { name: 'Pipelined Requests', data: pipelinedRequests, iterations: 15000 },
  ];

  for (const test of tests) {
    printSubHeader(test.name);
    console.log(`${colors.dim}Request size: ${test.data.length} bytes${colors.reset}`);

    const result = await runBenchmark(
      test.name,
      async () => {
        await parseHttpStream(bufferToStream(test.data), {
          onRequest() {},
          onResponse() {},
          onBody() {},
          onComplete() {},
        });
      },
      test.iterations,
    );

    printMetric('Throughput', formatNumber(result.ops), 'req/s', colors.green);
    printMetric('Total Time', (result.duration / 1000).toFixed(3), 'seconds');
    printMetric('Iterations', formatNumber(result.iterations));

    console.log(`\n${colors.dim}Latency per request:${colors.reset}`);
    printMetric('  Min', formatDuration(result.minLatency));
    printMetric('  Average', formatDuration(result.avgLatency));
    printMetric('  Median (P50)', formatDuration(result.p50Latency));
    printMetric('  P95', formatDuration(result.p95Latency), '', colors.yellow);
    printMetric('  P99', formatDuration(result.p99Latency), '', colors.yellow);
    printMetric('  Max', formatDuration(result.maxLatency));
  }
}

// Benchmark the direct API
async function benchmarkDirectAPI() {
  printHeader('Direct API Performance Benchmark');
  console.log(`${colors.dim}Testing HttpParser class with various request types${colors.reset}`);

  const llhttp = await getLLHttpInstance();

  const tests = [
    { name: 'Simple GET Request', data: simpleRequest, iterations: 100000 },
    { name: 'POST with Body', data: requestWithBody, iterations: 80000 },
    { name: 'Chunked Transfer', data: chunkedRequest, iterations: 60000 },
    { name: 'Large Headers', data: largeHeadersRequest, iterations: 20000 },
    { name: 'Pipelined Requests', data: pipelinedRequests, iterations: 40000 },
  ];

  for (const test of tests) {
    printSubHeader(test.name);
    console.log(`${colors.dim}Request size: ${test.data.length} bytes${colors.reset}`);

    const result = await runBenchmark(
      test.name,
      async () => {
        const parser = new HttpParser(llhttp, {
          onRequest() {},
          onResponse() {},
          onBody() {},
          onComplete() {},
        });
        parser.write(new Uint8Array(test.data));
        parser.destroy();
      },
      test.iterations,
    );

    printMetric('Throughput', formatNumber(result.ops), 'req/s', colors.green);
    printMetric('Total Time', (result.duration / 1000).toFixed(3), 'seconds');
    printMetric('Iterations', formatNumber(result.iterations));

    console.log(`\n${colors.dim}Latency per request:${colors.reset}`);
    printMetric('  Min', formatDuration(result.minLatency));
    printMetric('  Average', formatDuration(result.avgLatency));
    printMetric('  Median (P50)', formatDuration(result.p50Latency));
    printMetric('  P95', formatDuration(result.p95Latency), '', colors.yellow);
    printMetric('  P99', formatDuration(result.p99Latency), '', colors.yellow);
    printMetric('  Max', formatDuration(result.maxLatency));
  }
}

// Memory usage analysis
async function analyzeMemoryUsage() {
  printHeader('Memory Usage Analysis');

  const iterations = 10000;
  const llhttp = await getLLHttpInstance();

  // Stream API memory test
  printSubHeader('Stream API Memory Usage');

  if (global.gc) global.gc();
  const streamStart = process.memoryUsage();

  for (let i = 0; i < iterations; i++) {
    await parseHttpStream(bufferToStream(simpleRequest), {
      onRequest() {},
      onResponse() {},
      onBody() {},
      onComplete() {},
    });
  }

  if (global.gc) global.gc();
  const streamEnd = process.memoryUsage();

  printMetric('Initial Heap', (streamStart.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Final Heap', (streamEnd.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric(
    'Heap Growth',
    ((streamEnd.heapUsed - streamStart.heapUsed) / 1024 / 1024).toFixed(2),
    'MB',
  );
  printMetric('External Memory', (streamEnd.external / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Requests Processed', formatNumber(iterations));

  // Direct API memory test
  printSubHeader('Direct API Memory Usage');

  if (global.gc) global.gc();
  const directStart = process.memoryUsage();

  for (let i = 0; i < iterations; i++) {
    const parser = new HttpParser(llhttp, {
      onRequest() {},
      onResponse() {},
      onBody() {},
      onComplete() {},
    });
    parser.write(new Uint8Array(simpleRequest));
    parser.destroy();
  }

  if (global.gc) global.gc();
  const directEnd = process.memoryUsage();

  printMetric('Initial Heap', (directStart.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Final Heap', (directEnd.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric(
    'Heap Growth',
    ((directEnd.heapUsed - directStart.heapUsed) / 1024 / 1024).toFixed(2),
    'MB',
  );
  printMetric('External Memory', (directEnd.external / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Requests Processed', formatNumber(iterations));
}

// Pause/Resume functionality test (Direct API only)
async function benchmarkPauseResume() {
  printHeader('Pause/Resume Performance (Direct API)');
  console.log(`${colors.dim}Testing parser pause/resume functionality${colors.reset}`);

  const llhttp = await getLLHttpInstance();
  const iterations = 5000;

  printSubHeader('Pause on Every Body Chunk');

  let pauseCount = 0;
  const result = await runBenchmark(
    'Pause/Resume',
    async () => {
      const parser = new HttpParser(llhttp, {
        onRequest() {},
        onBody() {
          pauseCount++;
          return false; // Pause parsing
        },
        onComplete() {},
      });

      parser.write(new Uint8Array(requestWithBody));

      // Resume after pause
      if (parser.paused) {
        parser.resume();
      }

      parser.destroy();
    },
    iterations,
  );

  printMetric('Throughput', formatNumber(result.ops), 'req/s', colors.green);
  printMetric('Pause Operations', formatNumber(pauseCount));
  printMetric('Avg Latency', formatDuration(result.avgLatency));
  printMetric('P95 Latency', formatDuration(result.p95Latency), '', colors.yellow);
}

async function main() {
  console.log(
    `${colors.bright}${colors.cyan}http-parser Performance Benchmark Suite${colors.reset}`,
  );

  try {
    await benchmarkStreamAPI();
    await benchmarkDirectAPI();
    await analyzeMemoryUsage();
    await benchmarkPauseResume();

    console.log(`\n${colors.bright}${colors.green}✓ All benchmarks completed${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}✗ Benchmark failed:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
