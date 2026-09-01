# chordal: Web Audio Interaction Sounds

**chordal** is a tunable, zero-audio-file sound design system for the web: nine synthesized sound families, each covering ten interaction shapes, delivered as a lightweight library with no runtime dependencies and no audio files.

## Installation & Setup

Install via npm, then mark up HTML elements with `data-sound-*` attributes and call `bind()` once:

```ts
import { bind } from "chordal";
bind();
```

```html
<button data-sound-hover data-sound-click>Save</button>
```

The library is ESM-only and safe to import during SSR: nothing plays until a real user gesture triggers it in a browser.

## Usage Approaches

**Declarative method** uses data attributes — `data-sound-hover`, `data-sound-click`, `data-sound-success`, `data-sound-error`, `data-sound-toggle`, `data-sound-sent`, `data-sound-notification` — to trigger sounds automatically on their matching native event. A single `bind()` call wires up delegated listeners; safe to call again after DOM changes, already-bound elements are skipped.

**Imperative method** calls `play(instance, options?)` directly, for outcomes that don't map to a single DOM event: async completions, drag input, or destructive actions you want to gate behind your own confirmation step.

## Two axes: family and instance

Every sound is a **family** (its timbre) paired with an **instance** (its interaction shape). Pick one family with `setFamily()` and every instance inherits its character automatically; override per call with `play(instance, { family })`.

**Nine families**: `soft-bubble` (warm, round), `glass-crystal` (bright, resonant), `paper-snap` (dry, textured), `metallic-tact` (mechanical click), `chime` (bell-like), `digital-blip` (retro, electronic), `spring` (bouncy, twangy), `tiny-sparkle` (delicate, high-pitched), `snap` (percussive knock).

**Ten instances**: `hover`, `click`, `success`, `toggle`, `error`, `sent`, `notification` — all declarative via `data-sound-*` + `bind()` — plus three that need a direct call: `listening` (stateful, pass `{ state: 'on' | 'off' }`), `delete` (programmatic only, no data attribute, by design — never fire from a raw DOM event without your own confirmation step), and `slider` (continuous, call `playContinuous('slider', valueRatio)` on every `input` event of a range input).

## Key Features

- Zero runtime dependencies, pure ESM
- SSR-safe: `getContext()` returns `null` with no `window`/`AudioContext` present, every call becomes a silent no-op, never a throw
- ~6.9KB gzipped for all nine families; a single family via `chordal/lite`'s `createPlayer()` is ~4.2KB, about 39% smaller since the other eight families' data is never bundled at all
- `mute()` / `unmute()` / `isMuted()` for a global on/off switch
- `SOUND_FAMILIES` / `SOUND_INSTANCES` exported as readonly arrays for building your own family/instance picker UI

## Guidance

Pick one family for your product's whole sound identity rather than mixing families per element. Keep `hover`/`click` light and quick — they fire often. Reserve `success`/`error`/`notification` for moments that actually warrant an audio cue, not every state change. Respect `mute()`/`unmute()` if your app has its own sound settings; never autoplay before a real user gesture.
