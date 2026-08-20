/**
 * Chordal preset data — the sound families, their synthesis recipes, and the
 * tuned defaults for each family's 5 instances. Pure data + pure resolution
 * functions; no AudioContext access happens in this file (see engine.ts).
 *
 * Tuned toward real-world system UI sound (the Apple-style school of interaction
 * sound design) rather than melodic/game-like feedback: short (most instances sit
 * well under 100ms), minimal pitch movement (single notes or a tight two-note click,
 * not ascending arpeggios), dry (little to no shimmer/reverb tail), and restrained
 * in volume. A "reward" moment is a clean, brief, confident tick — not a fanfare.
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

// Down-stroke + a much quieter release tick — a physical couplet, not two equal hits.
const pressNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.55, lengthFraction: 0.45, pitchMultiplier: 1.06, volumeMultiplier: 0.35 },
];

// A muted, barely-descending click — a "blocked" signal, not a dramatic downward scoop.
const errorNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.88 }];

// Mechanical toggle click — down-stroke + a quiet settle, reused by the two "switch-like" families.
const toggleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.55, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.5, lengthFraction: 0.5, pitchMultiplier: 0.94, volumeMultiplier: 0.4 },
];

// soft-bubble: a single note with a hint of upward lift — not a bouncy multi-note run.
const softBubbleCongratsNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.12 }];

// paper-snap: quick double-tap — pitchMultiplier shifts the noise band's center since
// noise has no real pitch. Kept tight and short, not a melodic gesture.
const paperSnapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.35, lengthFraction: 0.45, pitchMultiplier: 1.08, volumeMultiplier: 1 },
];

// metallic-tact: two short clicks, not three — a confirm, not a ratchet count-up.
const metallicTactCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0.4, lengthFraction: 0.45, pitchMultiplier: 1.12, volumeMultiplier: 1 },
];

// digital-blip: one tick with a barely-there upward sweep — a confirm, not a run.
const digitalBlipCongratsNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.06 }];
// hover/press keep a quick, quiet click layered under the square tone for a little grit.
const digitalBlipHoverNotes: Note[] = [
  ...singleNote,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.35, useTexture: true },
];
const digitalBlipPressNotes: Note[] = [
  ...pressNotes,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.32, useTexture: true },
];

// snap: a tight two-note click, interval down from a fifth to barely a semitone —
// still "snappy," no longer a melodic resolve.
const snapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.85 },
  { offsetFraction: 0.35, lengthFraction: 0.45, pitchMultiplier: 1.06, volumeMultiplier: 1 },
];

export const FAMILY_RECIPES: Record<SoundFamily, FamilyRecipe> = {
  'soft-bubble': {
    waveform: 'sine',
    baseFrequency: 587, // D5
    filterType: 'lowpass',
    filterCutoffRange: [1200, 2600],
    filterQ: 0.8,
    // No delay — a shimmer tail read as decorative/whimsical; dry is closer to a real
    // system tap.
  },
  'glass-crystal': {
    waveform: 'sine',
    baseFrequency: 1046, // C6
    filterType: 'highpass',
    // Kept below the 1046Hz fundamental across the practical pitch range so a highpass
    // on a pure sine actually passes signal (see engine notes from the volume fix);
    // qRange still colors it via resonance as tone rises. No delay — dry "glass tick."
    filterCutoffRange: [500, 950],
    qRange: [1, 8],
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
    // Short comb-like metallic ring, toned down from the original — a confirm click,
    // not a decorative ring-out.
    delay: { time: 0.002, feedback: 0.2, wet: 0.3, lowpass: 3200 },
  },
  chime: {
    waveform: 'sine',
    baseFrequency: 860,
    filterType: 'bandpass',
    filterCutoffRange: [860, 1540],
    filterQ: 2,
    // No delay — the "classic ascending bell" identity is gone; this is a short, clean
    // tick now, not a decorative chime run.
  },
  'digital-blip': {
    waveform: 'square',
    baseFrequency: 360,
    filterType: 'bandpass',
    filterCutoffRange: [360, 880],
    filterQ: 5,
    // Barely-there slapback — was a much wetter tight delay; a system click doesn't ring.
    delay: { time: 0.015, feedback: 0.12, wet: 0.1, lowpass: 4000 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 5, volumeMultiplier: 0.32, lengthFraction: 0.25 },
  },
  spring: {
    waveform: 'sine',
    baseFrequency: 520,
    filterType: 'lowpass',
    filterCutoffRange: [520, 940],
    qRange: [1, 5], // resonance bump scales with tone — carries the family's character now
    // instead of a pitch-bounce gesture. No delay.
  },
  'tiny-sparkle': {
    waveform: 'sine',
    baseFrequency: 1040,
    filterType: 'highpass',
    filterCutoffRange: [1040, 2240],
    qRange: [1, 7],
    // Much lighter than before — a hint of shimmer, not a decorative tail.
    delay: { time: 0.03, feedback: 0.12, wet: 0.1, lowpass: 3800 },
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
    hover: preset(0.3, 0.011, 0.45, 'hover', singleNote),
    press: preset(0.4, 0.02, 0.42, 'press', pressNotes),
    congrats: preset(0.44, 0.075, 0.5, 'congrats', softBubbleCongratsNotes),
    error: preset(0.37, 0.045, 0.25, 'error', errorNotes),
    toggle: preset(0.37, 0.016, 0.42, 'toggle', singleNote),
  },
  'glass-crystal': {
    hover: preset(0.32, 0.009, 0.55, 'hover', singleNote),
    press: preset(0.42, 0.017, 0.5, 'press', pressNotes),
    congrats: preset(0.46, 0.07, 0.6, 'congrats', singleNote),
    error: preset(0.38, 0.04, 0.3, 'error', errorNotes),
    toggle: preset(0.4, 0.014, 0.5, 'toggle', singleNote),
  },
  'paper-snap': {
    hover: preset(0.26, 0.008, 0.5, 'hover', singleNote),
    press: preset(0.36, 0.015, 0.5, 'press', pressNotes),
    congrats: preset(0.4, 0.06, 0.55, 'congrats', paperSnapCongratsNotes),
    error: preset(0.34, 0.035, 0.3, 'error', errorNotes),
    toggle: preset(0.34, 0.014, 0.5, 'toggle', singleNote),
  },
  'metallic-tact': {
    hover: preset(0.3, 0.012, 0.45, 'hover', singleNote),
    press: preset(0.4, 0.022, 0.45, 'press', pressNotes),
    congrats: preset(0.44, 0.09, 0.5, 'congrats', metallicTactCongratsNotes),
    error: preset(0.37, 0.05, 0.3, 'error', errorNotes),
    toggle: preset(0.4, 0.02, 0.45, 'toggle', toggleClickNotes),
  },
  chime: {
    hover: preset(0.28, 0.01, 0.5, 'hover', singleNote),
    press: preset(0.38, 0.018, 0.5, 'press', pressNotes),
    congrats: preset(0.42, 0.075, 0.55, 'congrats', singleNote),
    error: preset(0.35, 0.042, 0.3, 'error', errorNotes),
    toggle: preset(0.36, 0.015, 0.5, 'toggle', singleNote),
  },
  'digital-blip': {
    hover: preset(0.26, 0.009, 0.4, 'hover', digitalBlipHoverNotes),
    press: preset(0.36, 0.016, 0.4, 'press', digitalBlipPressNotes),
    congrats: preset(0.4, 0.065, 0.45, 'congrats', digitalBlipCongratsNotes),
    error: preset(0.33, 0.038, 0.25, 'error', errorNotes),
    toggle: preset(0.34, 0.014, 0.4, 'toggle', toggleClickNotes),
  },
  spring: {
    hover: preset(0.29, 0.011, 0.45, 'hover', singleNote),
    press: preset(0.39, 0.02, 0.42, 'press', pressNotes),
    congrats: preset(0.42, 0.075, 0.48, 'congrats', singleNote),
    error: preset(0.36, 0.045, 0.28, 'error', errorNotes),
    toggle: preset(0.37, 0.017, 0.42, 'toggle', singleNote),
  },
  'tiny-sparkle': {
    hover: preset(0.24, 0.008, 0.2, 'hover', singleNote),
    press: preset(0.34, 0.014, 0.2, 'press', pressNotes),
    congrats: preset(0.38, 0.055, 0.3, 'congrats', singleNote),
    error: preset(0.32, 0.032, 0.12, 'error', errorNotes),
    toggle: preset(0.32, 0.012, 0.2, 'toggle', singleNote),
  },
  snap: {
    hover: preset(0.28, 0.009, 0.5, 'hover', singleNote),
    press: preset(0.38, 0.016, 0.5, 'press', pressNotes),
    congrats: preset(0.42, 0.06, 0.55, 'congrats', snapCongratsNotes),
    error: preset(0.35, 0.035, 0.32, 'error', errorNotes),
    toggle: preset(0.36, 0.014, 0.5, 'toggle', singleNote),
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
