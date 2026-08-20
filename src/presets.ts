/**
 * Chordal preset data — the sound families, their synthesis recipes, and the
 * tuned defaults for each family's 5 instances. Pure data + pure resolution
 * functions; no AudioContext access happens in this file (see engine.ts).
 */

import type { SynthParams, Waveform } from './engine';

export type SoundFamily =
  | 'soft-bubble'
  | 'glass-crystal'
  | 'paper-snap'
  | 'metallic-tact'
  | 'chime'
  | 'digital-blip'
  | 'spring'
  | 'tiny-sparkle'
  | 'snap';

export type SoundInstance = 'hover' | 'press' | 'congrats' | 'error' | 'toggle';

export const SOUND_FAMILIES: SoundFamily[] = [
  'soft-bubble',
  'glass-crystal',
  'paper-snap',
  'metallic-tact',
  'chime',
  'digital-blip',
  'spring',
  'tiny-sparkle',
  'snap',
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

const hoverGlide: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.2 }];

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

// --- The families below were mapped from a pasted external sound list (name/wave/base/
// spread + per-instance volume/pitch/length/tone for hover & congrats only). `spread`
// became each family's filterCutoffRange width above `base`; their length/volume values
// were on a different normalized scale, so they were rescaled proportionally into
// Chordal's actual hover/congrats ranges rather than used verbatim. press/error/toggle
// weren't provided — designed here using the same deltas the other families use.

// chime: classic 2-note ascending bell, detuned root for a richer ring.
const chimeCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.4, detuneCents: 7 },
  { offsetFraction: 0.4, lengthFraction: 0.55, pitchMultiplier: 1.5, volumeMultiplier: 1 },
];

// digital-blip: 2-note confirm with an upward sweep on the second note.
const digitalBlipCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0.3, lengthFraction: 0.6, pitchMultiplier: 1.4, volumeMultiplier: 1, sweepTo: 1.1 },
];
// digital-blip: hover/press get a glitchy high click layered under the square tone.
const digitalBlipHoverNotes: Note[] = [
  ...singleNote,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.45, useTexture: true },
];
const digitalBlipPressNotes: Note[] = [
  ...pressNotes,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.4, useTexture: true },
];

// spring: jumps high then settles back toward the root — elastic overshoot.
const springCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.3, lengthFraction: 0.65, pitchMultiplier: 1, volumeMultiplier: 1 },
];

// tiny-sparkle: a quick 3-note ascending twinkle.
const tinySparkleCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.22, lengthFraction: 0.3, pitchMultiplier: 1.3, volumeMultiplier: 0.85 },
  { offsetFraction: 0.44, lengthFraction: 0.4, pitchMultiplier: 1.6, volumeMultiplier: 1 },
];

// snap: a single unchanging pitch didn't read as "complete" — a quick double-snap that
// resolves upward on the second hit gives it somewhere to land, while staying snappy
// and transient rather than becoming a melodic run.
const snapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0.3, lengthFraction: 0.5, pitchMultiplier: 1.35, volumeMultiplier: 1 },
];

export const FAMILY_RECIPES: Record<SoundFamily, FamilyRecipe> = {
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
  chime: {
    waveform: 'sine',
    baseFrequency: 860,
    filterType: 'bandpass',
    filterCutoffRange: [860, 1540],
    filterQ: 2,
    delay: { time: 0.1, feedback: 0.28, wet: 0.35, lowpass: 3000 },
  },
  'digital-blip': {
    waveform: 'square',
    baseFrequency: 360,
    filterType: 'bandpass',
    filterCutoffRange: [360, 880],
    filterQ: 5,
    delay: { time: 0.03, feedback: 0.25, wet: 0.2, lowpass: 5000 }, // tight slapback
    textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 5, volumeMultiplier: 0.35, lengthFraction: 0.2 },
  },
  spring: {
    waveform: 'sine',
    baseFrequency: 520,
    filterType: 'lowpass',
    filterCutoffRange: [520, 940],
    qRange: [1, 5], // springy resonance bump scales with tone
    delay: { time: 0.06, feedback: 0.3, wet: 0.25, lowpass: 3000 }, // reinforces the springy resonance
  },
  'tiny-sparkle': {
    waveform: 'sine',
    baseFrequency: 1040,
    filterType: 'highpass',
    filterCutoffRange: [1040, 2240],
    qRange: [1, 7],
    delay: { time: 0.08, feedback: 0.3, wet: 0.3, lowpass: 5500 },
  },
  snap: {
    waveform: 'triangle',
    baseFrequency: 720,
    filterType: 'bandpass',
    filterCutoffRange: [720, 1620],
    filterQ: 3.5,
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
  chime: {
    hover: preset(0.37, 0.027, 0.6, 'hover', singleNote),
    press: preset(0.49, 0.045, 0.6, 'press', pressNotes),
    congrats: preset(0.62, 0.146, 0.64, 'congrats', chimeCongratsNotes),
    error: preset(0.45, 0.095, 0.36, 'error', errorNotes),
    toggle: preset(0.45, 0.049, 0.6, 'toggle', singleNote),
  },
  'digital-blip': {
    hover: preset(0.33, 0.023, 0.45, 'hover', digitalBlipHoverNotes),
    press: preset(0.45, 0.038, 0.45, 'press', digitalBlipPressNotes),
    congrats: preset(0.53, 0.133, 0.58, 'congrats', digitalBlipCongratsNotes),
    error: preset(0.41, 0.087, 0.27, 'error', errorNotes),
    toggle: preset(0.41, 0.041, 0.45, 'toggle', singleNote),
  },
  spring: {
    hover: preset(0.4, 0.028, 0.5, 'hover', singleNote),
    press: preset(0.52, 0.047, 0.5, 'press', pressNotes),
    congrats: preset(0.6, 0.143, 0.55, 'congrats', springCongratsNotes),
    error: preset(0.48, 0.093, 0.3, 'error', errorNotes),
    toggle: preset(0.48, 0.05, 0.5, 'toggle', singleNote),
  },
  'tiny-sparkle': {
    hover: preset(0.32, 0.015, 0.15, 'hover', singleNote),
    press: preset(0.44, 0.025, 0.15, 'press', pressNotes),
    congrats: preset(0.57, 0.21, 0.32, 'congrats', tinySparkleCongratsNotes),
    error: preset(0.4, 0.137, 0.09, 'error', errorNotes),
    toggle: preset(0.4, 0.027, 0.15, 'toggle', singleNote),
  },
  snap: {
    hover: preset(0.37, 0.019, 0.68, 'hover', singleNote),
    press: preset(0.49, 0.032, 0.68, 'press', pressNotes),
    congrats: preset(0.57, 0.131, 0.72, 'congrats', snapCongratsNotes),
    error: preset(0.45, 0.085, 0.41, 'error', errorNotes),
    toggle: preset(0.45, 0.035, 0.68, 'toggle', singleNote),
  },
};

/** Toggle's "off" state sits noticeably lower than "on" — the two states should read as distinct. */
const TOGGLE_PITCH_BY_STATE: Record<'on' | 'off', number> = { on: 1, off: 0.82 };

export function resolveToggleTuning(base: InstanceTuning, state: 'on' | 'off'): InstanceTuning {
  return { ...base, pitch: base.pitch * TOGGLE_PITCH_BY_STATE[state] };
}

/**
 * Resolves one note of an instance's gesture into concrete engine.SynthParams.
 * Pure function — no AudioContext access. soft-bubble's "distinguishing gimmick" is a
 * glide that scales its magnitude by `tone` rather than using a fixed amount, per the
 * synthesis recipe. A note with `useTexture` resolves from the family's fixed
 * textureLayer instead — a transient accent, not tone-sculpted.
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
  if (sweepTo !== undefined && family === 'soft-bubble') {
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
