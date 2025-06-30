import { performance } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { parseHttpStream } from '../src/http-parser.ts';

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

class PerformanceMonitor {
  private metrics: {
    requestsProcessed: number;
    totalLatency: number;
    minLatency: number;
    maxLatency: number;
    latencies: number[];
    errors: number;
    errorTypes: Map<string, number>;
    memoryUsage: NodeJS.MemoryUsage[];
    startTime: number;
    checkpoints: Array<{ time: number; requests: number }>;
  };

  constructor() {
    this.metrics = {
      requestsProcessed: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      latencies: [],
      errors: 0,
      errorTypes: new Map(),
      memoryUsage: [],
      startTime: performance.now(),
      checkpoints: [],
    };
  }

  recordRequest(latency: number, error: boolean = false, errorType?: string) {
    this.metrics.requestsProcessed++;
    if (error) {
      this.metrics.errors++;
      if (errorType) {
        this.metrics.errorTypes.set(errorType, (this.metrics.errorTypes.get(errorType) || 0) + 1);
      }
      return;
    }

    this.metrics.totalLatency += latency;
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.latencies.push(latency);
  }

  recordMemoryUsage() {
    this.metrics.memoryUsage.push(process.memoryUsage());
  }

  recordCheckpoint() {
    this.metrics.checkpoints.push({
      time: performance.now() - this.metrics.startTime,
      requests: this.metrics.requestsProcessed,
    });
  }

  getStats() {
    const duration = (performance.now() - this.metrics.startTime) / 1000; // seconds
    const latencies = this.metrics.latencies.sort((a, b) => a - b);
    const successfulRequests = this.metrics.requestsProcessed - this.metrics.errors;

    return {
      duration,
      requestsProcessed: this.metrics.requestsProcessed,
      requestsPerSecond: this.metrics.requestsProcessed / duration,
      errors: this.metrics.errors,
      errorRate: this.metrics.errors / this.metrics.requestsProcessed,
      errorTypes: Array.from(this.metrics.errorTypes.entries()),
      latency: {
        min: this.metrics.minLatency === Infinity ? 0 : this.metrics.minLatency,
        max: this.metrics.maxLatency,
        avg: successfulRequests > 0 ? this.metrics.totalLatency / successfulRequests : 0,
        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
        p999: latencies[Math.floor(latencies.length * 0.999)] || 0,
      },
      memory: {
        initial: this.metrics.memoryUsage[0],
        final: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
        peak:
          this.metrics.memoryUsage.length > 0
            ? this.metrics.memoryUsage.reduce((peak, current) =>
                current.heapUsed > peak.heapUsed ? current : peak,
              )
            : process.memoryUsage(),
      },
      checkpoints: this.metrics.checkpoints,
    };
  }
}

function createLoadTestStream(data: string | Uint8Array): ReadableStream<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let sent = false;

  return new ReadableStream({
    start(controller) {
      if (!sent) {
        controller.enqueue(bytes);
        sent = true;
        controller.close();
      }
    },
  });
}

// Simulate network delays
function createDelayedStream(
  data: string | Uint8Array,
  delayMs: number,
): ReadableStream<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  return new ReadableStream({
    async start(controller) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// Simulate chunked data arrival
function createChunkedStream(
  data: string | Uint8Array,
  chunkSize: number,
  delayBetweenChunks: number,
): ReadableStream<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        controller.enqueue(chunk);
        if (i + chunkSize < bytes.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
        }
      }
      controller.close();
    },
  });
}

class RequestGenerator {
  static simple(path = '/api/test'): string {
    return `GET ${path} HTTP/1.1\r\nHost: example.com\r\nUser-Agent: LoadTest/1.0\r\n\r\n`;
  }

  static withHeaders(headerCount = 10): string {
    let headers = 'GET /api/test HTTP/1.1\r\nHost: example.com\r\n';
    for (let i = 0; i < headerCount; i++) {
      headers += `X-Header-${i}: value-${i}-${Math.random().toString(36).substr(2, 9)}\r\n`;
    }
    headers += '\r\n';
    return headers;
  }

  static postWithBody(bodySize = 1000): string {
    const body = JSON.stringify({
      data: 'x'.repeat(Math.max(0, bodySize - 20)),
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9),
    }).substring(0, bodySize);
    return `POST /api/data HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
  }

  static chunkedEncoding(chunkSizes = [100, 200, 150]): string {
    let request =
      'POST /api/chunked HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n';

    for (const size of chunkSizes) {
      const chunk = 'a'.repeat(size);
      request += `${size.toString(16)}\r\n${chunk}\r\n`;
    }
    request += '0\r\n\r\n';

    return request;
  }

  static keepAliveSequence(count = 3): string {
    let requests = '';
    for (let i = 0; i < count; i++) {
      const connection = i === count - 1 ? 'close' : 'keep-alive';
      requests += `GET /api/test${i} HTTP/1.1\r\nHost: example.com\r\nConnection: ${connection}\r\n\r\n`;
    }
    return requests;
  }

  static websocketUpgrade(): string {
    return (
      'GET /ws HTTP/1.1\r\n' +
      'Host: example.com\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
      'Sec-WebSocket-Version: 13\r\n' +
      '\r\n'
    );
  }

  static realWorldMix(): string[] {
    return [
      this.simple('/'),
      this.simple('/api/users'),
      this.withHeaders(15),
      this.postWithBody(256),
      this.postWithBody(1024),
      this.simple('/health'),
      this.chunkedEncoding([64, 128, 64]),
      this.simple('/metrics'),
      this.websocketUpgrade(),
      this.postWithBody(4096),
    ];
  }

  static varyingBodySizes(): string[] {
    const sizes = [0, 100, 500, 1024, 2048, 4096, 8192, 16384];
    return sizes.map((size) => this.postWithBody(size));
  }
}

async function processStreamRequest(
  requestData: string | Uint8Array,
  options?: {
    delay?: number;
    chunked?: boolean;
    chunkSize?: number;
    chunkDelay?: number;
  },
): Promise<{ success: boolean; latency: number; error?: string }> {
  const startTime = performance.now();

  return new Promise((resolve) => {
    let success = false;
    let resolved = false;
    let error: string | undefined;

    const tryResolve = (isSuccess: boolean, errorMsg?: string) => {
      if (resolved) return;
      resolved = true;
      const latency = performance.now() - startTime;
      resolve({ success: isSuccess, latency, error: errorMsg });
    };

    const parserOptions = {
      onRequest() {
        success = true;
      },
      onResponse() {
        success = true;
      },
      onComplete() {
        if (!resolved) {
          tryResolve(success);
        }
      },
      onError(err: Error) {
        error = err.message;
        tryResolve(false, err.message);
      },
    };

    let stream: ReadableStream<Uint8Array>;
    if (options?.chunked) {
      stream = createChunkedStream(requestData, options.chunkSize || 10, options.chunkDelay || 1);
    } else if (options?.delay) {
      stream = createDelayedStream(requestData, options.delay);
    } else {
      stream = createLoadTestStream(requestData);
    }

    parseHttpStream(stream, parserOptions)
      .then(() => {
        setTimeout(() => {
          if (!resolved) {
            tryResolve(success);
          }
        }, 10);
      })
      .catch((err) => {
        tryResolve(false, err.message);
      });
  });
}

function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
    `${colors.dim}${label.padEnd(25)}${colors.reset} ${color}${value.padStart(10)}${colors.reset} ${colors.dim}${unit}${colors.reset}`,
  );
}

function printLatencyHistogram(latencies: number[]) {
  if (latencies.length === 0) return;

  const buckets = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const counts = new Array(buckets.length + 1).fill(0);

  latencies.forEach((latency) => {
    let bucketIndex = buckets.findIndex((b) => latency < b);
    if (bucketIndex === -1) bucketIndex = buckets.length;
    counts[bucketIndex]++;
  });

  console.log(`\n${colors.dim}Latency Distribution:${colors.reset}`);
  counts.forEach((count, i) => {
    if (count === 0) return;
    const percentage = (count / latencies.length) * 100;
    const bar = '█'.repeat(Math.round(percentage / 2));
    const label =
      i === 0
        ? `< ${buckets[0]}ms`
        : i === buckets.length
          ? `> ${buckets[buckets.length - 1]}ms`
          : `${buckets[i - 1]}-${buckets[i]}ms`;
    console.log(`  ${label.padEnd(12)} ${bar} ${percentage.toFixed(1)}%`);
  });
}

async function runSustainedLoadTest() {
  printHeader('Sustained Load Test');
  console.log(`${colors.dim}Testing sustained throughput over 10 seconds${colors.reset}`);

  const monitor = new PerformanceMonitor();
  const requests = RequestGenerator.realWorldMix();
  const testDuration = 10000; // 10 seconds for quick test
  const checkpointInterval = 2000; // 2 seconds

  monitor.recordMemoryUsage();

  let requestCount = 0;
  const startTime = performance.now();
  let nextCheckpoint = checkpointInterval;

  while (performance.now() - startTime < testDuration) {
    const request = requests[requestCount % requests.length];
    const result = await processStreamRequest(request);
    monitor.recordRequest(result.latency, !result.success, result.error);
    requestCount++;

    const elapsed = performance.now() - startTime;
    if (elapsed >= nextCheckpoint) {
      monitor.recordCheckpoint();
      process.stdout.write(
        `\r${colors.dim}Progress: ${Math.round(elapsed / 1000)}s - ${formatNumber(monitor.getStats().requestsProcessed)} requests processed${colors.reset}`,
      );
      nextCheckpoint += checkpointInterval;
    }
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  monitor.recordMemoryUsage();
  const stats = monitor.getStats();

  printMetric('Test Duration', stats.duration.toFixed(1), 'seconds');
  printMetric('Total Requests', formatNumber(stats.requestsProcessed));
  printMetric('Average Throughput', formatNumber(stats.requestsPerSecond), 'req/s', colors.green);
  printMetric(
    'Error Rate',
    (stats.errorRate * 100).toFixed(3),
    '%',
    stats.errorRate > 0.01 ? colors.red : colors.green,
  );

  console.log(`\n${colors.dim}Throughput over time:${colors.reset}`);
  stats.checkpoints.forEach((checkpoint, i) => {
    const prevTime = i > 0 ? stats.checkpoints[i - 1].time : 0;
    const prevRequests = i > 0 ? stats.checkpoints[i - 1].requests : 0;
    const intervalRequests = checkpoint.requests - prevRequests;
    const intervalTime = (checkpoint.time - prevTime) / 1000;
    const intervalThroughput = intervalRequests / intervalTime;

    printMetric(
      `  ${Math.round(checkpoint.time / 1000)}s`,
      formatNumber(intervalThroughput),
      'req/s',
      intervalThroughput < stats.requestsPerSecond * 0.9 ? colors.yellow : colors.green,
    );
  });

  console.log(`\n${colors.dim}Latency Statistics:${colors.reset}`);
  printMetric('  Min', stats.latency.min.toFixed(2), 'ms');
  printMetric('  Average', stats.latency.avg.toFixed(2), 'ms');
  printMetric('  P50', stats.latency.p50.toFixed(2), 'ms');
  printMetric('  P95', stats.latency.p95.toFixed(2), 'ms', colors.yellow);
  printMetric('  P99', stats.latency.p99.toFixed(2), 'ms', colors.yellow);
  printMetric('  P99.9', stats.latency.p999.toFixed(2), 'ms', colors.red);
  printMetric('  Max', stats.latency.max.toFixed(2), 'ms');

  // Get the actual latencies array from the monitor's internal metrics
  const latencyData = monitor.getStats().requestsProcessed > 0 ? monitor['metrics'].latencies : [];
  if (latencyData.length > 0) {
    printLatencyHistogram(latencyData);
  }

  console.log(`\n${colors.dim}Memory Usage:${colors.reset}`);
  printMetric('  Initial Heap', (stats.memory.initial.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('  Final Heap', (stats.memory.final.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('  Peak Heap', (stats.memory.peak.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  const memoryGrowth = (stats.memory.final.heapUsed - stats.memory.initial.heapUsed) / 1024 / 1024;
  printMetric(
    '  Memory Growth',
    memoryGrowth.toFixed(2),
    'MB',
    Math.abs(memoryGrowth) > 50 ? colors.yellow : colors.green,
  );

  if (stats.errorTypes.length > 0) {
    console.log(`\n${colors.dim}Error Types:${colors.reset}`);
    stats.errorTypes.forEach(([type, count]) => {
      printMetric(`  ${type}`, count.toString());
    });
  }

  return stats;
}

async function runBurstLoadTest() {
  printHeader('Burst Load Test');
  console.log(`${colors.dim}Testing handling of traffic bursts${colors.reset}`);

  const monitor = new PerformanceMonitor();
  const burstSizes = [100, 500, 1000, 2000];
  const delayBetweenBursts = 1000; // 1 second

  monitor.recordMemoryUsage();

  for (const burstSize of burstSizes) {
    printSubHeader(`Burst of ${formatNumber(burstSize)} requests`);

    const burstStart = performance.now();
    const promises = [];

    for (let i = 0; i < burstSize; i++) {
      const request = RequestGenerator.simple(`/burst-${i}`);
      promises.push(processStreamRequest(request));
    }

    const results = await Promise.all(promises);
    const burstDuration = (performance.now() - burstStart) / 1000;

    results.forEach((result) => {
      monitor.recordRequest(result.latency, !result.success, result.error);
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    printMetric('Burst Duration', burstDuration.toFixed(3), 'seconds');
    printMetric('Burst Throughput', formatNumber(burstSize / burstDuration), 'req/s', colors.green);
    printMetric(
      'Success Count',
      formatNumber(successCount),
      '',
      successCount === burstSize ? colors.green : colors.yellow,
    );
    printMetric(
      'Error Count',
      formatNumber(errorCount),
      '',
      errorCount > 0 ? colors.red : colors.green,
    );
    printMetric('Avg Latency', avgLatency.toFixed(2), 'ms');

    // Delay between bursts
    if (burstSize !== burstSizes[burstSizes.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBursts));
    }
  }

  monitor.recordMemoryUsage();
  const stats = monitor.getStats();

  console.log(`\n${colors.dim}Overall Burst Test Results:${colors.reset}`);
  printMetric('Total Requests', formatNumber(stats.requestsProcessed));
  printMetric(
    'Total Errors',
    formatNumber(stats.errors),
    '',
    stats.errors > 0 ? colors.red : colors.green,
  );
  printMetric('Error Rate', (stats.errorRate * 100).toFixed(3), '%');
  printMetric('P95 Latency', stats.latency.p95.toFixed(2), 'ms', colors.yellow);
  printMetric('P99 Latency', stats.latency.p99.toFixed(2), 'ms', colors.yellow);

  return stats;
}

async function runConcurrentLoadTest() {
  printHeader('High Concurrency Test');
  console.log(`${colors.dim}Testing with multiple concurrent connections${colors.reset}`);

  const concurrencyLevels = [10, 50, 100, 200];
  const requestsPerLevel = 1000;

  for (const concurrency of concurrencyLevels) {
    printSubHeader(`Concurrency Level: ${concurrency}`);

    const monitor = new PerformanceMonitor();
    const startTime = performance.now();

    // Create worker function
    const workerTasks = [];
    const requestsPerWorker = Math.floor(requestsPerLevel / concurrency);

    for (let i = 0; i < concurrency; i++) {
      const task = async () => {
        const requests = RequestGenerator.realWorldMix();
        for (let j = 0; j < requestsPerWorker; j++) {
          const request = requests[j % requests.length];
          const result = await processStreamRequest(request);
          return result;
        }
      };
      workerTasks.push(task());
    }

    // Process all workers concurrently
    const batchPromises = [];
    for (let i = 0; i < requestsPerWorker; i++) {
      const roundPromises = [];
      for (let j = 0; j < concurrency; j++) {
        const request = RequestGenerator.simple(`/concurrent-${j}-${i}`);
        roundPromises.push(processStreamRequest(request));
      }
      batchPromises.push(Promise.all(roundPromises));
    }

    const allResults = await Promise.all(batchPromises);
    const duration = (performance.now() - startTime) / 1000;

    // Flatten results and record metrics
    allResults.flat().forEach((result) => {
      monitor.recordRequest(result.latency, !result.success, result.error);
    });

    const stats = monitor.getStats();

    printMetric('Duration', duration.toFixed(2), 'seconds');
    printMetric('Total Requests', formatNumber(stats.requestsProcessed));
    printMetric('Throughput', formatNumber(stats.requestsPerSecond), 'req/s', colors.green);
    printMetric(
      'Error Rate',
      (stats.errorRate * 100).toFixed(3),
      '%',
      stats.errorRate > 0.01 ? colors.red : colors.green,
    );
    printMetric('Avg Latency', stats.latency.avg.toFixed(2), 'ms');
    printMetric('P95 Latency', stats.latency.p95.toFixed(2), 'ms', colors.yellow);
    printMetric('P99 Latency', stats.latency.p99.toFixed(2), 'ms', colors.yellow);
  }
}

async function runSlowClientTest() {
  printHeader('Slow Client Simulation');
  console.log(
    `${colors.dim}Testing parser performance with slow network conditions${colors.reset}`,
  );

  const monitor = new PerformanceMonitor();
  const scenarios = [
    { name: 'Fast Network (1ms chunks)', chunkSize: 50, chunkDelay: 1, count: 100 },
    { name: 'Moderate Network (10ms chunks)', chunkSize: 20, chunkDelay: 10, count: 50 },
    { name: 'Slow Network (50ms chunks)', chunkSize: 10, chunkDelay: 50, count: 20 },
    { name: 'Very Slow Network (100ms chunks)', chunkSize: 5, chunkDelay: 100, count: 10 },
  ];

  for (const scenario of scenarios) {
    printSubHeader(scenario.name);

    const scenarioStart = performance.now();
    const promises = [];

    for (let i = 0; i < scenario.count; i++) {
      const request = RequestGenerator.postWithBody(500);
      promises.push(
        processStreamRequest(request, {
          chunked: true,
          chunkSize: scenario.chunkSize,
          chunkDelay: scenario.chunkDelay,
        }),
      );
    }

    const results = await Promise.all(promises);
    const scenarioDuration = (performance.now() - scenarioStart) / 1000;

    results.forEach((result) => {
      monitor.recordRequest(result.latency, !result.success, result.error);
    });

    const successCount = results.filter((r) => r.success).length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    printMetric('Requests', scenario.count.toString());
    printMetric(
      'Success Rate',
      ((successCount / scenario.count) * 100).toFixed(1),
      '%',
      successCount === scenario.count ? colors.green : colors.yellow,
    );
    printMetric('Avg Latency', avgLatency.toFixed(2), 'ms');
    printMetric('Throughput', (scenario.count / scenarioDuration).toFixed(1), 'req/s');
  }
}

async function runMemoryStressTest() {
  printHeader('Memory Stress Test');
  console.log(`${colors.dim}Testing memory usage under various request sizes${colors.reset}`);

  const monitor = new PerformanceMonitor();
  const bodySizes = RequestGenerator.varyingBodySizes();
  const iterationsPerSize = 1000;

  monitor.recordMemoryUsage();

  for (let i = 0; i < bodySizes.length; i++) {
    const request = bodySizes[i];
    const bodySize = parseInt(request.match(/Content-Length: (\d+)/)?.[1] || '0');

    process.stdout.write(
      `\r${colors.dim}Testing ${formatNumber(bodySize)} byte bodies...${colors.reset}`,
    );

    for (let j = 0; j < iterationsPerSize; j++) {
      const result = await processStreamRequest(request);
      monitor.recordRequest(result.latency, !result.success, result.error);
    }

    if (global.gc && i % 2 === 0) {
      global.gc();
    }
    monitor.recordMemoryUsage();
  }

  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  const stats = monitor.getStats();
  const memoryGrowth = (stats.memory.final.heapUsed - stats.memory.initial.heapUsed) / 1024 / 1024;
  const memoryPerRequest = (memoryGrowth / stats.requestsProcessed) * 1000;

  printMetric('Total Requests', formatNumber(stats.requestsProcessed));
  printMetric(
    'Error Rate',
    (stats.errorRate * 100).toFixed(3),
    '%',
    stats.errorRate > 0.01 ? colors.red : colors.green,
  );
  printMetric('Initial Heap', (stats.memory.initial.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Final Heap', (stats.memory.final.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric('Peak Heap', (stats.memory.peak.heapUsed / 1024 / 1024).toFixed(2), 'MB');
  printMetric(
    'Memory Growth',
    memoryGrowth.toFixed(2),
    'MB',
    Math.abs(memoryGrowth) > 100 ? colors.red : colors.green,
  );
  printMetric('Memory per 1K req', memoryPerRequest.toFixed(2), 'MB');
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}HTTP Parser Heavy Load Test Suite${colors.reset}`);
  console.log(
    `${colors.dim}Simulating real-world load conditions and stress scenarios${colors.reset}`,
  );

  try {
    // Run all load tests
    await runSustainedLoadTest();
    await runBurstLoadTest();
    await runConcurrentLoadTest();
    await runSlowClientTest();
    await runMemoryStressTest();

    console.log(
      `\n${colors.bright}${colors.green}✓ All load tests completed successfully${colors.reset}`,
    );
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}✗ Load test failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Worker thread support for true parallel load testing
if (!isMainThread) {
  (async () => {
    const { requests, iterations } = workerData;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const request = requests[i % requests.length];
      const result = await processStreamRequest(request);
      results.push(result);
    }

    parentPort?.postMessage(results);
  })();
} else {
  // Run the load tests
  main();
}
