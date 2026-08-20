import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/engine.ts', 'src/presets.ts'],
  format: ['esm'],
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
});
