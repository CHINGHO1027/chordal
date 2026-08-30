/**
 * Chordal public API — play(), playContinuous(), bind(), and the active-family
 * setting. This is the only module consumers should import from directly.
 *
 * Imports every family. If you only ever use one, `import chime from 'chordal/chime'`
 * plus `createPlayer` from `chordal/lite` gives the same play()/bind() shape without
 * pulling in the other eight families' data.
 */

import * as engine from './engine';
import {
  PRESETS,
  FAMILY_RECIPES,
  SOUND_FAMILIES,
  SOUND_INSTANCES,
  resolveNoteParams,
  resolveToggleTuning,
  type InstanceTuning,
  type Note,
  type SoundFamily,
  type SoundInstance,
} from './presets';
import { createBinder } from './bind';
import { computeSliderVoices, createSliderState } from './continuous';

export { SOUND_FAMILIES, SOUND_INSTANCES };
export type { SoundFamily, SoundInstance };
export { mute, unmute, isMuted } from './engine';

const FALLBACK_NOTE: Note = { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 };

let activeFamily: SoundFamily = 'soft-bubble';

export function setFamily(family: SoundFamily): void {
  activeFamily = family;
}

export function getFamily(): SoundFamily {
  return activeFamily;
}

export interface PlayOptions extends Partial<InstanceTuning> {
  /** Override the active family for this call only. */
  family?: SoundFamily;
  /** Only meaningful for stateful instances (`toggle`, `listening`) — which state just became active. */
  state?: 'on' | 'off';
}

/**
 * Schedules one instance's gesture (one or more notes). Each note gets its own
 * engine instanceKey — `family:instance:noteIndex` — so a multi-note gesture's own
 * notes (e.g. congrats's ascending run) never duck each other via the engine's
 * anti-spam throttle. Repeating the *same* gesture too quickly still ducks correctly,
 * because each note-index slot is throttled against its own previous occurrence.
 *
 * All notes are submitted in one synchronous pass — each carries its own `startOffset`,
 * which the engine schedules against the AudioContext's own clock rather than a JS timer,
 * so a gesture's notes land sample-accurately regardless of event-loop jitter.
 */
function scheduleGesture(family: SoundFamily, instance: SoundInstance, tuning: InstanceTuning, notes: Note[]): void {
  const recipe = FAMILY_RECIPES[family];
  const activeNotes = notes.length > 0 ? notes : [FALLBACK_NOTE];
  activeNotes.forEach((note, index) => {
    const instanceKey = `${family}:${instance}:${index}`;
    const params = resolveNoteParams(recipe, tuning, note);
    const startOffset = note.offsetFraction * tuning.length;
    engine.playVoice(instanceKey, params, startOffset);
  });
}

/** Plays one instance of the active (or overridden) family, with optional live overrides. */
export function play(instance: SoundInstance, options: PlayOptions = {}): void {
  const family = options.family ?? activeFamily;
  const base = PRESETS[family][instance];

  let tuning: InstanceTuning = {
    volume: options.volume ?? base.volume,
    pitch: options.pitch ?? base.pitch,
    length: options.length ?? base.length,
    tone: options.tone ?? base.tone,
  };

  // Applied after options are merged in, not before — so a manual pitch override still
  // becomes the "on" pitch and "off" still drops proportionally underneath it, rather
  // than the override silently overwriting the state-driven split and making both states
  // sound identical.
  if ((instance === 'toggle' || instance === 'listening') && options.state) {
    tuning = resolveToggleTuning(tuning, options.state);
  }

  scheduleGesture(family, instance, tuning, base.notes);
}

// One SliderState for this whole module — matches this entry's own single
// active-family model (see continuous.ts's own comment on why lite.ts's createPlayer()
// instead gives each returned player its own state).
const sliderState = createSliderState();

export function playContinuous(action: 'slider', valueRatio: number, options: { family?: SoundFamily } = {}): void {
  if (action !== 'slider') return;
  const family = options.family ?? activeFamily;
  const voices = computeSliderVoices(FAMILY_RECIPES[family], PRESETS[family].hover, valueRatio, sliderState);
  if (!voices) return;
  engine.playVoice(`${family}:slider-body`, voices.body, 0, { maxVoices: 2 });
  engine.playVoice(`${family}:slider-click`, voices.click, 0, { maxVoices: 2 });
}

/**
 * Scans `root` (defaults to `document`) for data-sound-* attributes and wires up listeners.
 * Safe to call more than once (e.g. after DOM mutations) — already-bound elements
 * are skipped rather than double-bound. An attribute's own value (e.g.
 * data-sound-click="chime") overrides the family for just that element.
 */
export const bind = createBinder(play, { supportsFamilyOverride: true });
