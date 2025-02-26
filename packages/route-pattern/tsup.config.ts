import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/route-pattern.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
