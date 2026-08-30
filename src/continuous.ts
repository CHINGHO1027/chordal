/**
 * The playContinuous('slider', ...) synthesis math, factored out so both index.ts's
 * module-global player and lite.ts's per-instance createPlayer() players can share the
 * exact same tick sound instead of drifting apart under separate copies. State (debounce
 * timing, last ratio) is passed in explicitly rather than held here at module scope —
 * index.ts owns one SliderState for its whole module (matching its own single active-family
 * model), but lite.ts's createPlayer() gives each returned player its own SliderState, so
 * two independently created lite players (different families, both on the same page) never
 * share or fight over each other's debounce/speed feel.
 */

import type { SynthParams } from './engine';
import type { FamilyRecipe, InstancePreset } from './types';

// Major pentatonic scale (equal-tempered), spanning about 1.5 octaves — quantizes slider
// drag into discrete, musical steps instead of a continuous frequency sweep, which is
// what made it sound like a siren/mechanical sweep rather than an instrument.
const PENTATONIC_RATIOS = [1, 1.1225, 1.2599, 1.4983, 1.6818, 2, 2.245];

const SLIDER_DEBOUNCE_MS = 20;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export interface SliderState {
  lastTriggerAt: number;
  lastRatio: number | null;
  lastTimestamp: number;
}

export function createSliderState(): SliderState {
  return { lastTriggerAt: 0, lastRatio: null, lastTimestamp: 0 };
}

export interface SliderVoices {
  body: SynthParams;
  click: SynthParams;
}

/**
 * Continuous pitch mapping for range sliders — a dedicated dual-layer "tick" rather than
 * inheriting the active family's own (sometimes harsh/electronic) waveform:
 *   - Layer 1: a 5ms pink-noise burst for tactile click. Pink, not white — energy falls
 *     off toward high frequencies, so it reads as a soft tap rather than a hiss.
 *   - Layer 2: a lowpass sine for body, with a closing-filter decay tail (the cutoff
 *     sweeps down over the note instead of holding a fixed brightness) and a random
 *     ±10¢ detune per tick so repeated notes don't sound identically robotic.
 * Pitch is quantized to a pentatonic scale anchored on the family's own register, not
 * swept continuously. A 20ms hard debounce (mutates `state` in place, returns null when
 * a call should be skipped) plus a 2-voice cap per layer (the caller's own playVoice
 * `maxVoices` option) keep rapid dragging from overlapping into clipping. Movement speed
 * (how fast the ratio is changing between calls) nudges the body's filter brightness —
 * fast drags open up, slow ones stay soft — for a gesture-responsive feel instead of a
 * fixed timbre regardless of how it's played.
 */
export function computeSliderVoices(
  recipe: FamilyRecipe,
  hover: InstancePreset,
  valueRatio: number,
  state: SliderState
): SliderVoices | null {
  const t = now();
  if (t - state.lastTriggerAt < SLIDER_DEBOUNCE_MS) return null;

  const ratio = Math.min(Math.max(valueRatio, 0), 1);
  let speed = 0;
  if (state.lastRatio !== null && state.lastTimestamp) {
    const dtSeconds = Math.max((t - state.lastTimestamp) / 1000, 0.001);
    speed = Math.min(Math.abs(ratio - state.lastRatio) / dtSeconds / 4, 1);
  }
  state.lastRatio = ratio;
  state.lastTimestamp = t;
  state.lastTriggerAt = t;

  const root = recipe.baseFrequency;
  const stepIndex = Math.round(ratio * (PENTATONIC_RATIOS.length - 1));
  const frequency = root * (PENTATONIC_RATIOS[stepIndex] ?? 1);
  const detuneCents = Math.random() * 20 - 10;
  const bodyCutoff = 700 + speed * 2600;
  const bodyLength = Math.max(hover.length * 1.4, 0.02);

  const body: SynthParams = {
    waveform: 'sine',
    frequency,
    filterType: 'lowpass',
    filterCutoff: bodyCutoff,
    filterCutoffEnd: bodyCutoff * 0.35,
    filterQ: 0.9,
    volume: hover.volume * 0.75,
    length: bodyLength,
    detuneCents,
  };

  const click: SynthParams = {
    waveform: 'pink-noise',
    frequency: 0,
    filterType: 'lowpass',
    filterCutoff: 2600 + speed * 2000,
    filterQ: 1,
    volume: hover.volume * 0.35,
    length: 0.005,
  };

  return { body, click };
}
