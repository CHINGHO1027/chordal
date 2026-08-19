import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/engine.ts'],
  format: ['esm'],
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
});
