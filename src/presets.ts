/**
 * Chordal preset data — the 10 sound families, their synthesis recipes, and the
 * tuned defaults for each family's 5 instances. Pure data + pure resolution
 * functions; no AudioContext access happens in this file (see engine.ts).
 */

import type { SynthParams, Waveform } from './engine';

export type SoundFamily =
  | 'minimal-wood'
  | 'cyber-electric'
  | 'soft-bubble'
  | 'glass-crystal'
  | 'retro-8bit'
  | 'paper-snap'
  | 'metallic-tact'
  | 'zen-organic'
  | 'neo-pop'
  | 'deep-space';

export type SoundInstance = 'hover' | 'press' | 'congrats' | 'error' | 'toggle';

export const SOUND_FAMILIES: SoundFamily[] = [
  'minimal-wood',
  'cyber-electric',
  'soft-bubble',
  'glass-crystal',
  'retro-8bit',
  'paper-snap',
  'metallic-tact',
  'zen-organic',
  'neo-pop',
  'deep-space',
];

export const SOUND_INSTANCES: SoundInstance[] = ['hover', 'press', 'congrats', 'error', 'toggle'];

/** The 4 tunable parameters exposed per instance. */
export interface InstanceTuning {
  /** 0–1 */
  volume: number;
  /** Multiplier, default 1.0 */
  pitch: number;
  /** Seconds */
  length: number;
  /** 0–1, brightness/harmonic richness — meaning differs per family (see FamilyRecipe). */
  tone: number;
}

/** One note within an instance's gesture, expressed relative to the instance's own length. */
export interface Note {
  /** Fraction of total length at which this note starts (0–1). */
  offsetFraction: number;
  /** This note's own duration, as a fraction of total length. */
  lengthFraction: number;
  /** Pitch multiplier relative to the instance's resolved pitch. */
  pitchMultiplier: number;
  /** Volume multiplier relative to the instance's resolved volume. */
  volumeMultiplier: number;
  /** Optional intra-note pitch glide target, as a multiplier of this note's own frequency. */
  sweepTo?: number;
  /**
   * Detune in cents for this note specifically. A second note at the same offsetFraction
   * with a small detune (5–12¢) and lower volume layers in as width/warmth rather than
   * a second, independently audible pitch.
   */
  detuneCents?: number;
  /**
   * When true, this note is resolved from the family's `textureLayer` (a fixed noise
   * transient) instead of its primary waveform/filter — e.g. a soft knock layered under
   * a tonal note. Ignored if the family has no textureLayer.
   */
  useTexture?: boolean;
}

export interface InstancePreset extends InstanceTuning {
  notes: Note[];
}

/** A fixed noise-transient accent a family can layer under its primary tone. */
export interface TextureLayer {
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterQ?: number;
  /** Relative to the triggering note's own resolved volume. */
  volumeMultiplier: number;
  /** Relative to the triggering note's own resolved length — transients are usually short. */
  lengthFraction: number;
}

export interface FamilyRecipe {
  waveform: Waveform;
  /** Center of the family's tonal register in Hz (bandpass center, for noise-based families). */
  baseFrequency: number;
  filterType: BiquadFilterType;
  /** Filter cutoff at tone=0 and tone=1 — interpolated by the active instance's tone value. */
  filterCutoffRange: [number, number];
  /** Fixed filter Q. Ignored if qRange is set. */
  filterQ?: number;
  /** Filter Q at tone=0 and tone=1, for families whose "shimmer"/resonance scales with tone. */
  qRange?: [number, number];
  /** Internal feedback delay/shimmer tail — see engine.SynthParams['delay'] for field meaning. */
  delay?: { time: number; feedback: number; wet?: number; lowpass?: number };
  /** Optional fixed noise-transient a note can opt into via Note.useTexture. */
  textureLayer?: TextureLayer;
  /** Per-family override for the `slider` action's pitch-mapping range. Defaults to DEFAULT_PITCH_RANGE. */
  pitchRange?: [number, number];
}

export const DEFAULT_PITCH_RANGE: [number, number] = [0.8, 1.4];

export function getPitchRange(family: SoundFamily): [number, number] {
  return FAMILY_RECIPES[family].pitchRange ?? DEFAULT_PITCH_RANGE;
}

// Generic note shapes, reused by families that don't need a custom gesture.
const singleNote: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 }];

const pressNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.55, lengthFraction: 0.45, pitchMultiplier: 1.08, volumeMultiplier: 0.45 },
];

const errorNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.72 }];

const hoverChirp: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.35 }];
const hoverGlide: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.2 }];

// minimal-wood: press gets a soft wood-knock texture layered under the couplet.
const minimalWoodPressNotes: Note[] = [
  ...pressNotes,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.8, useTexture: true },
];
// A gentle stepwise rise (small intervals, not a triadic leap) with a detuned companion
// on the root for warmth — "understated," not a fanfare.
const minimalWoodCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.5, detuneCents: 7 },
  { offsetFraction: 0.3, lengthFraction: 0.4, pitchMultiplier: 1.12, volumeMultiplier: 0.9 },
  { offsetFraction: 0.6, lengthFraction: 0.45, pitchMultiplier: 1.26, volumeMultiplier: 1 },
];

// cyber-electric: hover/press both get a quick digital click layered under the tone.
const cyberElectricHoverNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.35 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
];
const cyberElectricPressNotes: Note[] = [
  ...pressNotes,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.45, useTexture: true },
];
// A fast 2-note stab with an upward sweep on the second note — "signal confirmed," not melodic.
const cyberElectricCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.9 },
  { offsetFraction: 0.3, lengthFraction: 0.55, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.15 },
];

// soft-bubble: bouncy up-down-up pattern (not a straight ascent) with a detuned root for roundness.
const softBubbleCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.45, detuneCents: 9 },
  { offsetFraction: 0.22, lengthFraction: 0.3, pitchMultiplier: 1.3, volumeMultiplier: 0.85 },
  { offsetFraction: 0.44, lengthFraction: 0.3, pitchMultiplier: 1.12, volumeMultiplier: 0.8 },
  { offsetFraction: 0.66, lengthFraction: 0.34, pitchMultiplier: 1.4, volumeMultiplier: 1 },
];

// glass-crystal: wide fifth-then-octave spread — bright and luxurious, not stepwise.
const glassCrystalCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.4, detuneCents: 5 },
  { offsetFraction: 0.22, lengthFraction: 0.5, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.44, lengthFraction: 0.56, pitchMultiplier: 2, volumeMultiplier: 1 },
];

// retro-8bit: literal 4-note chiptune run (root, major third, fifth, octave). Left pure —
// no texture/delay/detune, chiptune purity is the point.
const congratsNotesChiptune: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.22, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.2, lengthFraction: 0.22, pitchMultiplier: 1.26, volumeMultiplier: 0.85 },
  { offsetFraction: 0.4, lengthFraction: 0.22, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.6, lengthFraction: 0.35, pitchMultiplier: 2, volumeMultiplier: 1 },
];

// paper-snap: quick double-tap rather than a melodic run — pitchMultiplier shifts the
// noise band's center since noise has no real pitch.
const paperSnapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0.3, lengthFraction: 0.45, pitchMultiplier: 1.15, volumeMultiplier: 1 },
];

// metallic-tact: 3 evenly-spaced clicks at rising pitch — a mechanical ratchet/counter feel.
const metallicTactCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.25, lengthFraction: 0.3, pitchMultiplier: 1.2, volumeMultiplier: 0.9 },
  { offsetFraction: 0.5, lengthFraction: 0.35, pitchMultiplier: 1.4, volumeMultiplier: 1 },
];

// zen-organic: gentle 2-tone swell instead of a punchy run — same "ascending reward"
// concept, family-appropriate execution.
const congratsNotesSwell: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.65, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.45, lengthFraction: 0.6, pitchMultiplier: 1.15, volumeMultiplier: 1 },
];

// neo-pop: overshoot-then-settle — jumps past its landing pitch and bounces back, elastic feel.
const neoPopCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.28, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.2, lengthFraction: 0.3, pitchMultiplier: 1.6, volumeMultiplier: 1 },
  { offsetFraction: 0.42, lengthFraction: 0.28, pitchMultiplier: 1.3, volumeMultiplier: 0.85 },
  { offsetFraction: 0.62, lengthFraction: 0.38, pitchMultiplier: 1.5, volumeMultiplier: 0.95 },
];

// deep-space: same 3-note ascending shape as the old generic run, but spaced wider and
// held longer — immersive/ambient instead of tight and percussive.
const deepSpaceCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.4, lengthFraction: 0.5, pitchMultiplier: 1.25, volumeMultiplier: 0.9 },
  { offsetFraction: 0.75, lengthFraction: 0.55, pitchMultiplier: 1.5, volumeMultiplier: 1 },
];

export const FAMILY_RECIPES: Record<SoundFamily, FamilyRecipe> = {
  'minimal-wood': {
    waveform: 'sine',
    baseFrequency: 349, // F4 — warm, understated register
    filterType: 'lowpass',
    filterCutoffRange: [900, 2200],
    filterQ: 0.7,
    delay: { time: 0.09, feedback: 0.22, wet: 0.35, lowpass: 2200 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 380, filterQ: 2.2, volumeMultiplier: 0.35, lengthFraction: 0.4 },
  },
  'cyber-electric': {
    waveform: 'sawtooth',
    baseFrequency: 660,
    filterType: 'bandpass',
    filterCutoffRange: [800, 3200],
    filterQ: 6,
    delay: { time: 0.035, feedback: 0.3, wet: 0.25, lowpass: 6000 }, // tight digital slapback
    textureLayer: { filterType: 'bandpass', filterCutoff: 3500, filterQ: 4, volumeMultiplier: 0.4, lengthFraction: 0.25 },
    pitchRange: [0.75, 1.5],
  },
  'soft-bubble': {
    waveform: 'sine',
    baseFrequency: 587, // D5
    filterType: 'lowpass',
    filterCutoffRange: [1200, 2600],
    filterQ: 0.8,
    delay: { time: 0.1, feedback: 0.25, wet: 0.3, lowpass: 2600 },
  },
  'glass-crystal': {
    waveform: 'sine',
    baseFrequency: 1046, // C6
    filterType: 'highpass',
    filterCutoffRange: [1800, 5200],
    qRange: [1, 8],
    delay: { time: 0.13, feedback: 0.35, wet: 0.4, lowpass: 5000 },
    pitchRange: [0.7, 1.8],
  },
  'retro-8bit': {
    waveform: 'square',
    baseFrequency: 440, // A4
    filterType: 'lowpass',
    filterCutoffRange: [4000, 9000],
    filterQ: 0.5,
    pitchRange: [0.5, 2.0],
  },
  'paper-snap': {
    waveform: 'noise',
    baseFrequency: 3200, // bandpass center, since noise has no fundamental pitch
    filterType: 'bandpass',
    filterCutoffRange: [2200, 6000],
    filterQ: 3,
  },
  'metallic-tact': {
    waveform: 'square',
    baseFrequency: 784, // G5
    filterType: 'bandpass',
    filterCutoffRange: [1400, 3200],
    filterQ: 12,
    delay: { time: 0.002, feedback: 0.35, wet: 0.6, lowpass: 4000 }, // short comb-like metallic ring
  },
  'zen-organic': {
    waveform: 'sine',
    baseFrequency: 196, // G3 — low, calm register
    filterType: 'lowpass',
    filterCutoffRange: [400, 1000],
    filterQ: 0.6,
    delay: { time: 0.18, feedback: 0.3, wet: 0.3, lowpass: 800 }, // long, dark, disappearing tail
  },
  'neo-pop': {
    waveform: 'triangle',
    baseFrequency: 523, // C5
    filterType: 'lowpass',
    filterCutoffRange: [1000, 2400],
    qRange: [1, 6], // resonance bump scales with tone
    delay: { time: 0.07, feedback: 0.28, wet: 0.28, lowpass: 3200 },
  },
  'deep-space': {
    waveform: 'sine',
    baseFrequency: 65, // C2 — sub-bass
    filterType: 'lowpass',
    filterCutoffRange: [150, 500],
    filterQ: 0.7,
    delay: { time: 0.26, feedback: 0.45, wet: 0.5, lowpass: 400 }, // long, dark, ambient tail
    pitchRange: [0.9, 1.3],
  },
};

// Pitch offsets applied uniformly across families per instance — hover sits at the
// family's home register, error sits noticeably lower, congrats sits brighter.
const INSTANCE_PITCH: Record<SoundInstance, number> = {
  hover: 1.0,
  press: 0.95,
  congrats: 1.05,
  error: 0.85,
  toggle: 1.0,
};

function preset(volume: number, length: number, tone: number, instance: SoundInstance, notes: Note[]): InstancePreset {
  return { volume, length, tone, pitch: INSTANCE_PITCH[instance], notes };
}

export const PRESETS: Record<SoundFamily, Record<SoundInstance, InstancePreset>> = {
  'minimal-wood': {
    hover: preset(0.35, 0.024, 0.45, 'hover', singleNote),
    press: preset(0.5, 0.04, 0.45, 'press', minimalWoodPressNotes),
    congrats: preset(0.55, 0.18, 0.55, 'congrats', minimalWoodCongratsNotes),
    error: preset(0.45, 0.12, 0.25, 'error', errorNotes),
    toggle: preset(0.45, 0.045, 0.45, 'toggle', singleNote),
  },
  'cyber-electric': {
    hover: preset(0.45, 0.018, 0.7, 'hover', cyberElectricHoverNotes),
    press: preset(0.6, 0.03, 0.65, 'press', cyberElectricPressNotes),
    congrats: preset(0.65, 0.14, 0.75, 'congrats', cyberElectricCongratsNotes),
    error: preset(0.55, 0.09, 0.35, 'error', errorNotes),
    toggle: preset(0.55, 0.03, 0.6, 'toggle', singleNote),
  },
  'soft-bubble': {
    hover: preset(0.4, 0.026, 0.55, 'hover', hoverGlide),
    press: preset(0.5, 0.042, 0.5, 'press', pressNotes),
    congrats: preset(0.6, 0.17, 0.6, 'congrats', softBubbleCongratsNotes),
    error: preset(0.45, 0.11, 0.3, 'error', errorNotes),
    toggle: preset(0.48, 0.05, 0.5, 'toggle', singleNote),
  },
  'glass-crystal': {
    hover: preset(0.38, 0.022, 0.75, 'hover', singleNote),
    press: preset(0.5, 0.035, 0.7, 'press', pressNotes),
    congrats: preset(0.6, 0.2, 0.85, 'congrats', glassCrystalCongratsNotes),
    error: preset(0.45, 0.1, 0.4, 'error', errorNotes),
    toggle: preset(0.48, 0.04, 0.7, 'toggle', singleNote),
  },
  'retro-8bit': {
    hover: preset(0.45, 0.02, 0.5, 'hover', singleNote),
    press: preset(0.6, 0.03, 0.5, 'press', pressNotes),
    congrats: preset(0.65, 0.22, 0.55, 'congrats', congratsNotesChiptune),
    error: preset(0.5, 0.1, 0.3, 'error', errorNotes),
    toggle: preset(0.55, 0.035, 0.5, 'toggle', singleNote),
  },
  'paper-snap': {
    hover: preset(0.35, 0.015, 0.55, 'hover', singleNote),
    press: preset(0.5, 0.025, 0.55, 'press', pressNotes),
    congrats: preset(0.55, 0.13, 0.6, 'congrats', paperSnapCongratsNotes),
    error: preset(0.45, 0.08, 0.3, 'error', errorNotes),
    toggle: preset(0.45, 0.025, 0.5, 'toggle', singleNote),
  },
  'metallic-tact': {
    hover: preset(0.42, 0.026, 0.5, 'hover', singleNote),
    press: preset(0.58, 0.045, 0.5, 'press', pressNotes),
    congrats: preset(0.6, 0.16, 0.6, 'congrats', metallicTactCongratsNotes),
    error: preset(0.5, 0.11, 0.3, 'error', errorNotes),
    toggle: preset(0.55, 0.05, 0.5, 'toggle', singleNote),
  },
  'zen-organic': {
    hover: preset(0.3, 0.028, 0.3, 'hover', singleNote),
    press: preset(0.4, 0.05, 0.3, 'press', pressNotes),
    congrats: preset(0.45, 0.24, 0.35, 'congrats', congratsNotesSwell),
    error: preset(0.4, 0.14, 0.2, 'error', errorNotes),
    toggle: preset(0.38, 0.06, 0.3, 'toggle', singleNote),
  },
  'neo-pop': {
    hover: preset(0.42, 0.026, 0.6, 'hover', singleNote),
    press: preset(0.55, 0.04, 0.55, 'press', pressNotes),
    congrats: preset(0.62, 0.17, 0.7, 'congrats', neoPopCongratsNotes),
    error: preset(0.5, 0.1, 0.35, 'error', errorNotes),
    toggle: preset(0.52, 0.045, 0.55, 'toggle', singleNote),
  },
  'deep-space': {
    hover: preset(0.4, 0.028, 0.25, 'hover', singleNote),
    press: preset(0.5, 0.045, 0.25, 'press', pressNotes),
    congrats: preset(0.55, 0.25, 0.35, 'congrats', deepSpaceCongratsNotes),
    error: preset(0.45, 0.14, 0.15, 'error', errorNotes),
    toggle: preset(0.45, 0.05, 0.25, 'toggle', singleNote),
  },
};

/** Toggle's "off" state sits noticeably lower than "on" — the two states should read as distinct. */
const TOGGLE_PITCH_BY_STATE: Record<'on' | 'off', number> = { on: 1, off: 0.82 };

export function resolveToggleTuning(base: InstanceTuning, state: 'on' | 'off'): InstanceTuning {
  return { ...base, pitch: base.pitch * TOGGLE_PITCH_BY_STATE[state] };
}

/**
 * Resolves one note of an instance's gesture into concrete engine.SynthParams.
 * Pure function — no AudioContext access. Families whose "distinguishing gimmick" is a
 * glide/chirp (soft-bubble, cyber-electric) scale that sweep's magnitude by `tone` rather
 * than using a fixed amount, per the synthesis recipe. A note with `useTexture` resolves
 * from the family's fixed textureLayer instead — a transient accent, not tone-sculpted.
 */
export function resolveNoteParams(family: SoundFamily, tuning: InstanceTuning, note: Note): SynthParams {
  const recipe = FAMILY_RECIPES[family];
  const toneT = Math.min(Math.max(tuning.tone, 0), 1);

  const noteLength = Math.max(tuning.length * note.lengthFraction, 0.005);
  const noteVolume = Math.min(Math.max(tuning.volume * note.volumeMultiplier, 0), 1);
  const pitchMultiplier = tuning.pitch * note.pitchMultiplier;

  if (note.useTexture && recipe.textureLayer) {
    const tex = recipe.textureLayer;
    return {
      waveform: 'noise',
      frequency: 0,
      filterType: tex.filterType,
      filterCutoff: tex.filterCutoff,
      filterQ: tex.filterQ ?? 1,
      volume: Math.min(Math.max(noteVolume * tex.volumeMultiplier, 0), 1),
      length: Math.max(noteLength * tex.lengthFraction, 0.003),
      detuneCents: note.detuneCents ?? 0,
    };
  }

  const [cutoffLow, cutoffHigh] = recipe.filterCutoffRange;
  const filterCutoff = cutoffLow + (cutoffHigh - cutoffLow) * toneT;
  const filterQ = recipe.qRange ? recipe.qRange[0] + (recipe.qRange[1] - recipe.qRange[0]) * toneT : recipe.filterQ ?? 1;

  if (recipe.waveform === 'noise') {
    return {
      waveform: 'noise',
      frequency: 0, // unused for noise sources
      filterType: recipe.filterType,
      filterCutoff: recipe.baseFrequency * pitchMultiplier,
      filterQ,
      volume: noteVolume,
      length: noteLength,
      delay: recipe.delay,
      detuneCents: note.detuneCents ?? 0,
    };
  }

  const frequency = recipe.baseFrequency * pitchMultiplier;

  let sweepTo = note.sweepTo;
  if (sweepTo !== undefined && (family === 'soft-bubble' || family === 'cyber-electric')) {
    sweepTo = 1 + (sweepTo - 1) * toneT;
  }

  return {
    waveform: recipe.waveform,
    frequency,
    endFrequency: sweepTo !== undefined ? frequency * sweepTo : undefined,
    filterType: recipe.filterType,
    filterCutoff,
    filterQ,
    volume: noteVolume,
    length: noteLength,
    delay: recipe.delay,
    detuneCents: note.detuneCents ?? 0,
  };
}
