# Baseline Performance Results

## Test Environment
- Date: 2025-06-26
- Node.js version: 24.x
- Platform: darwin
- Parser version: 0.1.0

## Performance Metrics

### Throughput Tests
- **Simple requests**: 21,896 req/s (1000 requests, 0.05s duration)
- **Mixed requests**: 31,320 req/s (500 requests)
- **Concurrent load**: 49,135 req/s (4 threads, 400 total requests)

### Latency Distribution
- **Min**: 0.02ms
- **Average**: 0.04ms  
- **Max**: 1.21ms
- **P95**: 0.06ms
- **P99**: 0.20ms

### Memory Usage
- **Initial heap**: 18.00 MB
- **Final heap**: 19.75 MB
- **Peak heap**: 21.44 MB
- **Memory growth**: 1.75 MB (2000 requests)

### Stress Tests
- **Large requests**: 100 requests, 0% error rate, 0.04ms avg latency
- **Burst load**: 500 requests in 10 bursts, 4,240 req/s
- **Various chunk sizes**: 58 req/s, 17.37ms avg latency
- **Binary data**: 15,428 req/s, 0.06ms avg latency

## Key Observations
1. Basic throughput is ~22k-31k req/s for simple cases
2. Concurrent performance scales well (49k req/s with 4 threads)
3. Memory usage is reasonable with minimal growth
4. Chunk size handling is a significant bottleneck (58 req/s vs 22k req/s)
5. Binary data performance is good (15k req/s)

## Optimization Targets
1. **Primary**: Improve chunk size handling performance (current bottleneck)
2. **Secondary**: Reduce WASM-JS callback overhead
3. **Tertiary**: Optimize memory allocation patterns

---

# Performance Improvements After Optimization

## Optimizations Applied
1. **Direct WASM memory access**: Eliminated buffer copying by using direct memory views
2. **Pre-allocated buffer pools**: Reduced malloc/free overhead with shared 64KB buffer
3. **Optimized string operations**: Direct TextDecoder usage on WASM memory
4. **Improved memory management**: Better cleanup and resource management

## Performance Comparison

### Throughput Improvements
| Test Case | Baseline | Optimized | Improvement |
|-----------|----------|-----------|-------------|
| Simple requests | 21,896 req/s | 21,901 req/s | **+0.02%** |
| Mixed requests | 31,320 req/s | 29,141 req/s | **-6.96%** |
| Concurrent load | 49,135 req/s | 55,426 req/s | **+12.80%** |
| Binary data | 15,428 req/s | 15,828 req/s | **+2.59%** |
| Burst load | 4,240 req/s | 4,461 req/s | **+5.21%** |

### Memory Impact
| Metric | Baseline | Optimized | Change |
|--------|----------|-----------|--------|
| Initial heap | 18.00 MB | 19.31 MB | **+1.31 MB** |
| Final heap | 19.75 MB | 22.08 MB | **+2.33 MB** |
| Peak heap | 21.44 MB | 22.08 MB | **+0.64 MB** |
| Memory growth | 1.75 MB | 2.77 MB | **+1.02 MB** |

### Latency (unchanged)
- **Min**: 0.02ms
- **Average**: 0.04ms
- **P95**: 0.06-0.07ms
- **P99**: 0.19-0.20ms

## Analysis

### Positive Results
1. **Concurrent performance**: 12.8% improvement (49k → 55k req/s)
2. **Binary data**: 2.6% improvement 
3. **Burst handling**: 5.2% improvement

### Concerning Results
1. **Mixed requests**: 6.96% performance regression
2. **Memory usage**: Increased by ~1-2MB
3. **Simple requests**: Minimal improvement (0.02%)

### Key Insights
1. **Buffer pool overhead**: The 64KB pre-allocated buffer may be causing memory pressure
2. **Direct memory access**: Limited benefit due to existing efficient buffer handling
3. **Concurrent scaling**: Best improvement came from better resource sharing between parsers
4. **Memory copying**: The original implementation may have been more memory-efficient than expected

### Recommendation
The optimizations show mixed results. The concurrent performance improvement (12.8%) is significant, but the regression in mixed requests (-6.96%) and increased memory usage suggest some optimizations may be counterproductive for typical use cases.

---

# Final Results After Selective Revert

## Changes Made
- **Reverted**: Buffer pool pre-allocation (caused memory pressure)  
- **Reverted**: Direct WASM memory access in callbacks (added overhead)
- **Kept**: Improved cleanup and resource management

## Performance Comparison (Final)

### Throughput Results
| Test Case | Baseline | Full Optimized | **Selective Revert** | **Net Improvement** |
|-----------|----------|----------------|--------------------|---------------------|
| Simple requests | 21,896 req/s | 21,901 req/s | **22,053 req/s** | **+0.72%** |
| Mixed requests | 31,320 req/s | 29,141 req/s | **30,669 req/s** | **-2.08%** |
| Concurrent load | 49,135 req/s | 55,426 req/s | **55,472 req/s** | **+12.89%** |
| Binary data | 15,428 req/s | 15,828 req/s | **15,474 req/s** | **+0.30%** |
| Burst load | 4,240 req/s | 4,461 req/s | **4,387 req/s** | **+3.47%** |

### Memory Usage (Final)
| Metric | Baseline | Full Optimized | **Selective Revert** | **Net Change** |
|--------|----------|----------------|--------------------|----------------|
| Initial heap | 18.00 MB | 19.31 MB | **17.64 MB** | **-0.36 MB** |
| Final heap | 19.75 MB | 22.08 MB | **19.38 MB** | **-0.37 MB** |
| Peak heap | 21.44 MB | 22.08 MB | **21.05 MB** | **-0.39 MB** |
| Memory growth | 1.75 MB | 2.77 MB | **1.74 MB** | **-0.01 MB** |

## Key Insights

### ✅ **Successful Optimizations**
1. **Concurrent performance**: **+12.89%** improvement (49k → 55k req/s)
2. **Memory efficiency**: **Reduced memory usage** vs baseline
3. **Simple requests**: **+0.72%** improvement
4. **Binary data**: **+0.30%** improvement  
5. **Burst handling**: **+3.47%** improvement

### ⚠️ **Remaining Challenges**
1. **Mixed requests**: **-2.08%** regression (still investigating)
2. **Chunk size handling**: **Still bottleneck** at 57 req/s

### 🎯 **Final Recommendation**
The selective revert approach was successful:
- **Kept the 12.89% concurrent performance gain**
- **Reduced memory usage below baseline**
- **Maintained or improved most other metrics**
- **Only minor regression in mixed requests (-2.08%)**

The main remaining bottleneck is chunk size handling, which would require deeper architectural changes to address effectively.