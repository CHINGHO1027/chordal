import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/lite.ts',
    'src/families/soft-bubble.ts',
    'src/families/glass-crystal.ts',
    'src/families/paper-snap.ts',
    'src/families/metallic-tact.ts',
    'src/families/chime.ts',
    'src/families/digital-blip.ts',
    'src/families/spring.ts',
    'src/families/tiny-sparkle.ts',
    'src/families/snap.ts',
    'src/playground/chordal-playground.ts',
  ],
  format: ['esm'],
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
});
