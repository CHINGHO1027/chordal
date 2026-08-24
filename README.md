# chordal

A tunable, zero-audio-file sonic design system for the web, powered by the Web Audio API.

Nine sound families, seven interaction shapes each, synthesized live. No audio files, no downloads, nothing to configure. ESM-only, zero runtime dependencies, safe to import during SSR: nothing plays until a real user gesture triggers it in a browser.

## Install

```
npm install chordal
```

## Quick start

Mark up your HTML with `data-sound-*` attributes and call `bind()` once, or call `play()` directly whenever you need exact control.

```html
<button data-sound-hover data-sound-click>Save</button>
```

```ts
import { bind } from 'chordal';

bind();
```

## Attributes

| Attribute | Fires on | Instance |
|---|---|---|
| `data-sound-hover` | `pointerenter` | `hover` |
| `data-sound-click` | `pointerdown` | `click` |
| `data-sound-congrats` | `click` | `congrats` |
| `data-sound-error` | `invalid` | `error` |
| `data-sound-toggle` | `click` | `toggle` |
| `data-sound-submit` | `click` | `submit` |
| `data-sound-notification` | `click` | `notification` |

Leave the attribute value empty to use the active family, or set it to any family name (`data-sound-click="chime"`) to override just that element.

## API

### `play(instance, options?)`

```ts
play(instance: SoundInstance, options?: PlayOptions): void
```

The direct, imperative trigger. Call it from your own event handlers or async callbacks. `options` overrides `family`, `volume`, `pitch`, `length`, or `tone` for just this call, plus `state: 'on' | 'off'` for the `toggle` instance.

```ts
import { play } from 'chordal';

play('congrats', { family: 'glass-crystal' });
```

### `bind(root?)`

```ts
bind(root?: ParentNode): void
```

Scans `root` (defaults to `document`) for `data-sound-*` attributes and wires up the matching listeners in one pass. Safe to call again after DOM changes: already-bound elements are skipped, never double-bound.

### `playContinuous(action, valueRatio, options?)`

```ts
playContinuous(action: 'slider', valueRatio: number, options?: { family?: SoundFamily }): void
```

For continuous drag interactions like a range slider. Call it on every `input` event with the current 0-1 ratio. Debounced and pitch-quantized internally, so fast dragging reads as musical steps, not a siren sweep.

```ts
slider.addEventListener('input', () => {
  playContinuous('slider', Number(slider.value) / 100);
});
```

### `setFamily(family)` / `getFamily()`

The family `play()` and `bind()` use when a call doesn't override its own. Call `setFamily()` once, for example from a theme/settings picker, to change your whole app's sound identity.

### `mute()` / `unmute()` / `isMuted()`

Global on/off switch for the master output.

### `SOUND_FAMILIES` / `SOUND_INSTANCES`

Exported readonly arrays for building your own family/instance picker UI without hardcoding the list.

## Families

| Family | Character |
|---|---|
| `soft-bubble` | Warm, round, gentle: a soft pop with a pleasant, slightly sweet tone. |
| `glass-crystal` | Bright and resonant, like a light tap on crystal, delicate but clear. |
| `paper-snap` | Dry, textured noise: a papery crackle rather than a musical tone. |
| `metallic-tact` | A mechanical, tactile click, resonant in a way that reads as hardware. |
| `chime` | Bell-like and tonal: a clean ring that decays naturally. |
| `digital-blip` | Squared-off and retro, clearly electronic, an 8-bit-style blip. |
| `spring` | Bouncy and twangy, with a springy pitch character true to the name. |
| `tiny-sparkle` | Delicate and high-pitched: light and glittery. |
| `snap` | A percussive knock, dry and immediate. |

## Instances

| Instance | Use |
|---|---|
| `hover` | A light, quick probe for pointer-enter feedback, weightless, with no reverb tail. |
| `click` | The core tactile confirmation for a press. |
| `congrats` | A short celebratory phrase for a completed action. |
| `toggle` | A two-part mechanical snap for switching between on/off states. |
| `error` | A descending, dissonant phrase signaling something went wrong, bound to the native `invalid` event. |
| `submit` | For the moment an async action actually starts. |
| `notification` | For when something appears without user action, like a toast. |
| `slider` | Continuous, pitch-quantized feedback while dragging a range input (`playContinuous()` only). |

## License

MIT
