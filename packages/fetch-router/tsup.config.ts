import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/fetch-router.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
