# Updating llhttp

This document describes the process for updating the llhttp dependency in the http-parser package.

## Prerequisites

- Docker installed and running
- Node.js (version specified in package.json)
- Git

## Update Process

### Automatic Update (Recommended)

Use the provided update script to automatically update llhttp to a specific version:

```bash
npm run update:llhttp <tag>
```

For example, to update to version v9.2.1:

```bash
npm run update:llhttp v9.2.1
```

This script will:
1. Clone the llhttp repository at the specified tag
2. Build llhttp from source
3. Copy the necessary files to the deps directory
4. Build the WASM binaries using Docker
5. Update all files in the llhttp directory

### Manual Update Process

If you need to update llhttp manually:

1. **Clone the llhttp repository**:
   ```bash
   git clone https://github.com/nodejs/llhttp.git
   cd llhttp
   git checkout <tag>
   ```

2. **Build llhttp**:
   ```bash
   npm install
   npm run build-wasm
   ```

3. **Copy JavaScript/TypeScript files**:
   ```bash
   cp build/wasm/*.js ../request-parser/llhttp/
   cp build/wasm/*.js.map ../request-parser/llhttp/
   cp build/wasm/*.d.ts ../request-parser/llhttp/
   ```

4. **Copy C source files**:
   ```bash
   cp src/native/api.c src/native/http.c ../request-parser/deps/llhttp/src/
   cp build/c/llhttp.c ../request-parser/deps/llhttp/src/
   ```

5. **Copy header files**:
   ```bash
   cp src/native/api.h ../request-parser/deps/llhttp/include/
   cp build/llhttp.h ../request-parser/deps/llhttp/include/
   ```

6. **Build WASM binaries**:
   ```bash
   cd ../request-parser
   npm run build:wasm
   ```

## Directory Structure

The request-parser package maintains the following structure for llhttp:

```
request-parser/
├── deps/llhttp/           # C source files for building WASM
│   ├── include/          # Header files
│   │   ├── api.h
│   │   └── llhttp.h
│   └── src/              # C source files
│       ├── api.c
│       ├── http.c
│       └── llhttp.c
├── llhttp/               # Built WASM and JavaScript files
│   ├── constants.d.ts
│   ├── constants.js
│   ├── constants.js.map
│   ├── llhttp-wasm.js
│   ├── llhttp.wasm
│   ├── llhttp_simd-wasm.js
│   ├── llhttp_simd.wasm
│   ├── utils.d.ts
│   ├── utils.js
│   └── utils.js.map
└── scripts/
    ├── build-wasm.js    # Build script for WASM compilation
    └── update-llhttp.js # Script to update llhttp version
```

## Build Process

The WASM build process uses a Docker container to ensure consistent builds across different environments:

- **Docker Image**: `ghcr.io/nodejs/wasm-builder@sha256:975f391d907e42a75b8c72eb77c782181e941608687d4d8694c3e9df415a0970`
- **Compiler**: Clang with WASI SDK
- **Optimization**: Level 4 with wasm-opt
- **Two builds**: Regular and SIMD-optimized versions

## Testing

After updating llhttp, always run the tests to ensure compatibility:

```bash
npm test
npm run test:load
```

## Troubleshooting

### Docker Issues

If you encounter Docker-related errors:
1. Ensure Docker is running
2. Check that you have permissions to run Docker commands
3. Verify that the Docker image can be pulled

### Build Errors

If the build fails:
1. Ensure all C source files were copied correctly
2. Check that the deps directory structure matches the expected layout
3. Verify that the Docker container has the necessary tools

### Test Failures

If tests fail after updating:
1. Check for breaking changes in the llhttp changelog
2. Verify that all files were updated correctly
3. Consider if the request-parser code needs updates for compatibility