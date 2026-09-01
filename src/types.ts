/**
 * Chordal's core types — split out from the family data so a per-family import
 * (see families/*.ts) never has to pull in every other family just to get its own types.
 */

import type { Waveform } from './engine';

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

export type SoundInstance = 'hover' | 'click' | 'success' | 'error' | 'toggle' | 'sent' | 'notification' | 'listening' | 'delete';

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

export const SOUND_INSTANCES: SoundInstance[] = [
  'hover',
  'click',
  'success',
  'error',
  'toggle',
  'sent',
  'notification',
  'listening',
  'delete',
];

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
   * When true, this note is resolved as a noise transient from the family's `textureLayer`
   * instead of its primary waveform/filter — e.g. a soft knock layered under a tonal note.
   * Ignored if the family has no textureLayer. Pass an inline filter spec instead of `true`
   * when a note needs its own noise character that doesn't match the family's shared
   * texture (e.g. a soft lowpass "breath" under a family whose texture layer is tuned as a
   * bright bandpass flick) — bypasses the family's textureLayer and its extra
   * volume/length scaling entirely; this note's own volumeMultiplier/lengthFraction apply
   * directly.
   */
  useTexture?: boolean | { filterType: BiquadFilterType; filterCutoff: number; filterQ?: number };
  /**
   * Set false to skip the family's shimmer/delay on this note specifically. Defaults to
   * true. The delay's feedback tail runs for a fixed duration independent of note length
   * (see engine.shimmerTailSeconds) — for an instant, weightless cue like hover, that tail
   * lingers long after the note itself has ended, which reads as heavy rather than light.
   */
  useDelay?: boolean;
  /**
   * Optional attack-time override in seconds — see engine.SynthParams['attack']. Only
   * needed for genuine "swell" gestures (e.g. sent's lift-off); every other note relies
   * on the engine's default fast attack.
   */
  attack?: number;
  /**
   * Set false to skip the family's filter entirely for this note — a raw, unfiltered
   * oscillator. Defaults to true. Cuelume's own tone layers never carry a filter at all
   * (only their noise layers do); reusing a family's own filter on a note tuned to sit
   * well outside its passband (e.g. a low reference-match tone under a family whose
   * bandpass centers much higher) would attenuate it rather than leave it clean.
   */
  useFilter?: boolean;
  /**
   * Override the family's own waveform for this note specifically. Only meant for a noise
   * family's rare note that needs a genuinely stable, trackable pitch — filtered noise
   * (even a narrow, high-Q bandpass) always retains some random amplitude/phase wobble
   * within the passband, which reads as "ringing" rather than "a tone," so a family whose
   * voice is noise structurally can't produce the same clean descending pitch every other
   * family's error relies on without this.
   */
  waveformOverride?: Waveform;
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
  /**
   * Only soft-bubble sets this. When true, a note's `sweepTo` glide magnitude scales with
   * `tone` (see resolve.ts's resolveNoteParams) instead of being fixed — this family's own
   * "gimmick." A flag rather than a hardcoded family-name check so resolveNoteParams and
   * isToneAudible stay generic over any FamilyRecipe, not just this one by name.
   */
  toneScalesSweep?: boolean;
}

export const DEFAULT_PITCH_RANGE: [number, number] = [0.8, 1.4];

/** One family's complete, self-contained data — everything a single `chordal/<family>` import needs. */
export interface SoundFamilyModule {
  name: SoundFamily;
  recipe: FamilyRecipe;
  presets: Record<SoundInstance, InstancePreset>;
}
