import { defineConfig } from 'tsup';

export default defineConfig([
  // Platform-neutral build
  {
    clean: false,
    dts: true,
    entry: ['src/s3-file-storage.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
]);
