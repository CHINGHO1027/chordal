import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/playground/chordal-playground.ts'],
  format: ['esm'],
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
});
