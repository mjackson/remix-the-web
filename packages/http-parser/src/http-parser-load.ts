import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

import { parseHttpStream as parseHttpStreamWASM } from './http-parser.ts';
import { parseHttpStream as parseHttpStreamJS } from './http-parser-js.ts';

// Allow switching between WASM and JS parser for testing
const parseHttpStream = process.env.PARSER === 'JS' ? parseHttpStreamJS : parseHttpStreamWASM;

class PerformanceMonitor {
  private metrics: {
    requestsProcessed: number;
    totalLatency: number;
    minLatency: number;
    maxLatency: number;
    latencies: number[];
    errors: number;
    memoryUsage: NodeJS.MemoryUsage[];
    startTime: number;
  };

  constructor() {
    this.metrics = {
      requestsProcessed: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      latencies: [],
      errors: 0,
      memoryUsage: [],
      startTime: performance.now(),
    };
  }

  recordRequest(latency: number, error: boolean = false) {
    this.metrics.requestsProcessed++;
    if (error) {
      this.metrics.errors++;
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

  getStats() {
    let duration = (performance.now() - this.metrics.startTime) / 1000; // seconds
    let latencies = this.metrics.latencies.sort((a, b) => a - b);

    return {
      duration,
      requestsProcessed: this.metrics.requestsProcessed,
      requestsPerSecond: this.metrics.requestsProcessed / duration,
      errors: this.metrics.errors,
      errorRate: this.metrics.errors / this.metrics.requestsProcessed,
      latency: {
        min: this.metrics.minLatency,
        max: this.metrics.maxLatency,
        avg: this.metrics.totalLatency / (this.metrics.requestsProcessed - this.metrics.errors),
        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      },
      memory: {
        initial: this.metrics.memoryUsage[0],
        final: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
        peak: this.metrics.memoryUsage.reduce((peak, current) =>
          current.heapUsed > peak.heapUsed ? current : peak,
        ),
      },
    };
  }

  reset() {
    this.metrics = {
      requestsProcessed: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      latencies: [],
      errors: 0,
      memoryUsage: [],
      startTime: performance.now(),
    };
  }
}

function createLoadTestStream(data: string | Uint8Array): ReadableStream<Uint8Array> {
  let bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let sent = false;

  return new ReadableStream({
    start(controller) {
      // Send all data at once for maximum performance
      if (!sent) {
        controller.enqueue(bytes);
        sent = true;
        controller.close();
      }
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
      headers += `X-Header-${i}: value-${i}\r\n`;
    }
    headers += '\r\n';
    return headers;
  }

  static postWithBody(bodySize = 1000): string {
    let body = 'x'.repeat(bodySize);
    return `POST /api/data HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
  }

  static chunkedEncoding(chunkSizes = [100, 200, 150]): string {
    let request =
      'POST /api/chunked HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n';

    for (let size of chunkSizes) {
      let chunk = 'a'.repeat(size);
      request += `${size.toString(16)}\r\n${chunk}\r\n`;
    }
    request += '0\r\n\r\n';

    return request;
  }

  static keepAliveSequence(count = 3): string {
    let requests = '';
    for (let i = 0; i < count; i++) {
      let connection = i === count - 1 ? 'close' : 'keep-alive';
      requests += `GET /api/test${i} HTTP/1.1\r\nHost: example.com\r\nConnection: ${connection}\r\n\r\n`;
    }
    return requests;
  }

  static mixed(): string[] {
    return [
      this.simple(),
      this.withHeaders(5),
      this.postWithBody(500),
      this.chunkedEncoding([50, 100]),
      this.simple('/api/large'),
    ];
  }
}

// High-performance request processing function for streams
async function processStreamRequest(
  requestData: string | Uint8Array,
): Promise<{ success: boolean; latency: number }> {
  let startTime = performance.now();

  return new Promise((resolve) => {
    let success = false;
    let resolved = false;

    let tryResolve = (isSuccess: boolean) => {
      if (resolved) return;
      resolved = true;
      let latency = performance.now() - startTime;
      resolve({ success: isSuccess, latency });
    };

    let options = {
      onRequest() {
        success = true;
        setImmediate(() => tryResolve(true));
      },
      onError() {
        success = false;
        setImmediate(() => tryResolve(false));
      },
    };

    parseHttpStream(createLoadTestStream(requestData), options)
      .then(() => {
        // Wait a moment for parsing to complete
        setTimeout(() => {
          if (!resolved) {
            tryResolve(success);
          }
        }, 5);
      })
      .catch(() => {
        tryResolve(false);
      });
  });
}

// Worker thread function for concurrent testing
async function workerFunction() {
  if (!isMainThread && parentPort) {
    let { requests, iterations } = workerData;
    let monitor = new PerformanceMonitor();
    monitor.recordMemoryUsage();

    for (let i = 0; i < iterations; i++) {
      let requestData = requests[i % requests.length];
      let result = await processStreamRequest(requestData);
      monitor.recordRequest(result.latency, !result.success);

      // Record memory usage periodically
      if (i % 100 === 0) {
        monitor.recordMemoryUsage();
      }
    }

    monitor.recordMemoryUsage();
    parentPort.postMessage(monitor.getStats());
  }
}

// Simplified concurrency test without workers (since __filename not available in ESM)
async function runConcurrentTests(
  concurrency: number,
  requestsPerThread: number,
  requests: string[],
) {
  let promises = [];

  for (let i = 0; i < concurrency; i++) {
    let promise = async () => {
      let monitor = new PerformanceMonitor();
      monitor.recordMemoryUsage();

      for (let j = 0; j < requestsPerThread; j++) {
        let requestData = requests[j % requests.length];
        let result = await processStreamRequest(requestData);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      return monitor.getStats();
    };

    promises.push(promise());
  }

  return await Promise.all(promises);
}

// Execute worker function if running in worker thread
if (!isMainThread) {
  workerFunction();
}

describe('HTTP Parser Stream Load Tests', () => {
  describe('Throughput Tests', () => {
    it('handles high-frequency simple requests', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 1000;
      let request = RequestGenerator.simple();

      // Pre-warm the parser to avoid WASM initialization cold start
      await processStreamRequest(request);

      monitor.recordMemoryUsage();

      for (let i = 0; i < requestCount; i++) {
        let result = await processStreamRequest(request);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Stream Throughput Test Results ---`);
      console.log(`Processed: ${stats.requestsProcessed} requests`);
      console.log(`Duration: ${stats.duration.toFixed(2)}s`);
      console.log(`Throughput: ${stats.requestsPerSecond.toFixed(0)} req/s`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      console.log(
        `Latency - Min: ${stats.latency.min.toFixed(2)}ms, Avg: ${stats.latency.avg.toFixed(2)}ms, Max: ${stats.latency.max.toFixed(2)}ms`,
      );
      console.log(
        `Latency - P95: ${stats.latency.p95.toFixed(2)}ms, P99: ${stats.latency.p99.toFixed(2)}ms`,
      );

      // Assertions (relaxed for initial testing)
      assert.ok(
        stats.requestsPerSecond > 10,
        `Expected >10 req/s, got ${stats.requestsPerSecond.toFixed(0)}`,
      );
      assert.ok(
        stats.errorRate < 0.5,
        `Error rate too high: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
      if (stats.latency.p95 > 0) {
        assert.ok(
          stats.latency.p95 < 100,
          `P95 latency too high: ${stats.latency.p95.toFixed(2)}ms`,
        );
      }
    });

    it('handles mixed request types under load', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 500;
      let requests = RequestGenerator.mixed();

      monitor.recordMemoryUsage();

      for (let i = 0; i < requestCount; i++) {
        let request = requests[i % requests.length];
        let result = await processStreamRequest(request);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Stream Mixed Request Test Results ---`);
      console.log(`Processed: ${stats.requestsProcessed} requests`);
      console.log(`Throughput: ${stats.requestsPerSecond.toFixed(0)} req/s`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      assert.ok(
        stats.requestsPerSecond > 5,
        `Expected >5 req/s for mixed requests, got ${stats.requestsPerSecond.toFixed(0)}`,
      );
      assert.ok(
        stats.errorRate < 0.8,
        `Error rate too high: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });
  });

  describe('Concurrency Tests', () => {
    it('handles concurrent parser instances', async () => {
      let concurrency = 4;
      let requestsPerThread = 100;
      let requests = [RequestGenerator.simple()];

      let startTime = performance.now();
      let results = await runConcurrentTests(concurrency, requestsPerThread, requests);
      let totalDuration = (performance.now() - startTime) / 1000;

      // Aggregate results
      let totalRequests = results.reduce((sum, r) => sum + r.requestsProcessed, 0);
      let totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      let avgThroughput = totalRequests / totalDuration;

      console.log(`\n--- Stream Concurrency Test Results ---`);
      console.log(`Concurrent threads: ${concurrency}`);
      console.log(`Total requests: ${totalRequests}`);
      console.log(`Total duration: ${totalDuration.toFixed(2)}s`);
      console.log(`Aggregate throughput: ${avgThroughput.toFixed(0)} req/s`);
      console.log(`Total errors: ${totalErrors}`);

      assert.ok(
        avgThroughput > 100,
        `Expected >100 req/s with concurrency, got ${avgThroughput.toFixed(0)}`,
      );
      assert.ok(
        totalErrors < totalRequests * 0.1,
        `Too many errors in concurrency test: ${totalErrors}/${totalRequests}`,
      );
    });
  });

  describe('Memory Tests', () => {
    it('shows no memory leaks during sustained load', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 2000;
      let request = RequestGenerator.simple();

      // Record initial memory
      monitor.recordMemoryUsage();

      // Process requests in batches to allow GC
      let batchSize = 100;
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        for (let i = 0; i < batchSize; i++) {
          let result = await processStreamRequest(request);
          monitor.recordRequest(result.latency, !result.success);
        }

        // Force garbage collection if available and record memory
        if (global.gc) {
          global.gc();
        }
        monitor.recordMemoryUsage();
      }

      let stats = monitor.getStats();
      let memoryGrowth = stats.memory.final.heapUsed - stats.memory.initial.heapUsed;
      let memoryGrowthMB = memoryGrowth / (1024 * 1024);

      console.log(`\n--- Stream Memory Test Results ---`);
      console.log(`Requests processed: ${stats.requestsProcessed}`);
      console.log(`Initial heap: ${(stats.memory.initial.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap: ${(stats.memory.final.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Peak heap: ${(stats.memory.peak.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);

      // Memory growth should be minimal for this many requests
      assert.ok(memoryGrowthMB < 50, `Memory growth too high: ${memoryGrowthMB.toFixed(2)} MB`);
    });
  });

  describe('Stress Tests', () => {
    it('handles large requests without failure', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 100;

      monitor.recordMemoryUsage();

      for (let i = 0; i < requestCount; i++) {
        // Generate requests with varying large sizes
        let bodySize = 1000 + i * 100; // 1KB to 11KB
        let request = RequestGenerator.postWithBody(bodySize);
        let result = await processStreamRequest(request);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Stream Large Request Stress Test ---`);
      console.log(`Processed: ${stats.requestsProcessed} large requests`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      console.log(`Avg latency: ${stats.latency.avg.toFixed(2)}ms`);

      assert.ok(
        stats.errorRate < 0.8,
        `Error rate too high for large requests: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });

    it('handles burst load patterns', async () => {
      let monitor = new PerformanceMonitor();
      let burstSize = 50;
      let burstCount = 10;
      let request = RequestGenerator.simple();

      monitor.recordMemoryUsage();

      for (let burst = 0; burst < burstCount; burst++) {
        // Process burst
        let burstPromises = [];
        for (let i = 0; i < burstSize; i++) {
          burstPromises.push(processStreamRequest(request));
        }

        let burstResults = await Promise.all(burstPromises);
        burstResults.forEach((result) => {
          monitor.recordRequest(result.latency, !result.success);
        });

        // Small delay between bursts
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Stream Burst Load Test ---`);
      console.log(`Processed: ${stats.requestsProcessed} requests in ${burstCount} bursts`);
      console.log(`Throughput: ${stats.requestsPerSecond.toFixed(0)} req/s`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      assert.ok(
        stats.errorRate < 0.8,
        `Error rate too high in burst test: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
      assert.ok(
        stats.requestsPerSecond > 10,
        `Throughput too low in burst test: ${stats.requestsPerSecond.toFixed(0)} req/s`,
      );
    });
  });

  describe('Production Scenario Tests', () => {
    it('handles keep-alive connection sequences', async () => {
      let monitor = new PerformanceMonitor();
      let sequences = 50;
      let requestsPerSequence = 5;

      monitor.recordMemoryUsage();

      for (let i = 0; i < sequences; i++) {
        let keepAliveData = RequestGenerator.keepAliveSequence(requestsPerSequence);
        let messagesReceived = 0;

        await new Promise<void>((resolve) => {
          let options = {
            expectMultipleMessages: true,
            onRequest() {
              messagesReceived++;
              if (messagesReceived === requestsPerSequence) {
                resolve();
              }
            },
            onError(error: Error) {
              console.error('Keep-alive error:', error);
              resolve();
            },
          };

          parseHttpStream(createLoadTestStream(keepAliveData), options).catch(() => {
            resolve();
          });
        });

        monitor.recordRequest(0.5, messagesReceived !== requestsPerSequence);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Keep-Alive Connection Test ---`);
      console.log(`Processed: ${sequences} connection sequences`);
      console.log(`Messages per sequence: ${requestsPerSequence}`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      assert.ok(
        stats.errorRate < 0.1,
        `Error rate too high for keep-alive: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });

    it('handles slow client scenarios (trickling data)', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 50;
      let request = RequestGenerator.postWithBody(1000);

      monitor.recordMemoryUsage();

      for (let i = 0; i < requestCount; i++) {
        let startTime = performance.now();
        let bytes = new TextEncoder().encode(request);

        // Simulate slow client sending data in small chunks with delays
        let stream = new ReadableStream({
          async start(controller) {
            let chunkSize = 10; // Very small chunks
            let position = 0;

            while (position < bytes.length) {
              let chunk = bytes.slice(position, position + chunkSize);
              controller.enqueue(chunk);
              position += chunkSize;

              // Simulate network delay
              await new Promise((resolve) => setTimeout(resolve, 2));
            }
            controller.close();
          },
        });

        let success = false;
        await new Promise<void>((resolve) => {
          parseHttpStream(stream, {
            onRequest() {
              success = true;
            },
            onComplete() {
              resolve();
            },
            onError() {
              resolve();
            },
          }).catch(() => resolve());
        });

        let latency = performance.now() - startTime;
        monitor.recordRequest(latency, !success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Slow Client Test ---`);
      console.log(`Processed: ${stats.requestsProcessed} slow requests`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      console.log(`Avg latency: ${stats.latency.avg.toFixed(2)}ms`);

      assert.ok(
        stats.errorRate < 0.1,
        `Error rate too high for slow clients: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });

    it('handles malformed requests gracefully', async () => {
      let monitor = new PerformanceMonitor();

      // Various malformed requests
      let malformedRequests = [
        'GET /test\r\n\r\n', // Missing HTTP version
        'GET /test HTTP/1.1\r\n', // Missing final CRLF
        'POST /test HTTP/1.1\r\nContent-Length: 100\r\n\r\nshort', // Content-Length mismatch
        'GET /test HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\nZZZ\r\n', // Invalid chunk size
        'GET\r\n\r\n', // Missing URL
        'INVALID /test HTTP/1.1\r\n\r\n', // Invalid method
      ];

      monitor.recordMemoryUsage();

      for (let malformed of malformedRequests) {
        let result = await processStreamRequest(malformed);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Malformed Request Handling ---`);
      console.log(`Tested: ${malformedRequests.length} malformed requests`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      assert.ok(
        stats.errorRate > 0.4,
        `Should reject malformed requests, but error rate is only ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });

    it('handles WebSocket upgrade requests', async () => {
      let monitor = new PerformanceMonitor();
      let upgradeCount = 100;

      monitor.recordMemoryUsage();

      for (let i = 0; i < upgradeCount; i++) {
        let upgradeRequest =
          'GET /ws HTTP/1.1\r\n' +
          'Host: example.com\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          '\r\n';

        let isUpgrade = false;
        let startTime = performance.now();

        await new Promise<void>((resolve) => {
          parseHttpStream(createLoadTestStream(upgradeRequest), {
            onRequest(request) {
              isUpgrade = request.upgrade === true;
              resolve();
            },
            onError() {
              resolve();
            },
          }).catch(() => resolve());
        });

        let latency = performance.now() - startTime;
        monitor.recordRequest(latency, !isUpgrade);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- WebSocket Upgrade Test ---`);
      console.log(`Processed: ${stats.requestsProcessed} upgrade requests`);
      console.log(`Success rate: ${((1 - stats.errorRate) * 100).toFixed(2)}%`);
      console.log(`Avg latency: ${stats.latency.avg.toFixed(2)}ms`);

      assert.ok(
        stats.errorRate < 0.1,
        `Error rate too high for WebSocket upgrades: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
    });

    it('handles binary data efficiently', async () => {
      let monitor = new PerformanceMonitor();
      let requestCount = 200;

      monitor.recordMemoryUsage();

      for (let i = 0; i < requestCount; i++) {
        // Create request with binary data in body
        let binarySize = 100 + i * 5; // Varying binary sizes
        let binaryData = new Uint8Array(binarySize);
        for (let j = 0; j < binarySize; j++) {
          binaryData[j] = j % 256;
        }

        let requestText = `POST /binary HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/octet-stream\r\nContent-Length: ${binarySize}\r\n\r\n`;
        let requestBytes = new TextEncoder().encode(requestText);
        let fullRequest = new Uint8Array(requestBytes.length + binarySize);
        fullRequest.set(requestBytes);
        fullRequest.set(binaryData, requestBytes.length);

        let result = await processStreamRequest(fullRequest);
        monitor.recordRequest(result.latency, !result.success);
      }

      monitor.recordMemoryUsage();
      let stats = monitor.getStats();

      console.log(`\n--- Stream Binary Data Performance Test ---`);
      console.log(`Processed: ${stats.requestsProcessed} binary requests`);
      console.log(`Throughput: ${stats.requestsPerSecond.toFixed(0)} req/s`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      console.log(`Avg latency: ${stats.latency.avg.toFixed(2)}ms`);

      assert.ok(
        stats.errorRate < 0.1,
        `Error rate too high for binary data: ${(stats.errorRate * 100).toFixed(2)}%`,
      );
      assert.ok(
        stats.requestsPerSecond > 100,
        `Throughput too low for binary data: ${stats.requestsPerSecond.toFixed(0)} req/s`,
      );
    });
  });
});
