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

export type SoundInstance = 'hover' | 'click' | 'congrats' | 'error' | 'toggle' | 'submit' | 'notification';

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

export const SOUND_INSTANCES: SoundInstance[] = ['hover', 'click', 'congrats', 'error', 'toggle', 'submit', 'notification'];

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
   * needed for genuine "swell" gestures (e.g. submit's lift-off); every other note relies
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
}

export const DEFAULT_PITCH_RANGE: [number, number] = [0.8, 1.4];

export function getPitchRange(family: SoundFamily): [number, number] {
  return FAMILY_RECIPES[family].pitchRange ?? DEFAULT_PITCH_RANGE;
}

// Generic note shapes, reused by families that don't need a custom gesture.
const singleNote: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 }];

// hover: genuinely dry — no shimmer tail. A family's shimmer feedback tail runs for a
// fixed duration independent of note length (see engine.shimmerTailSeconds), so without
// useDelay:false an "instant" 8-12ms hover would still trail hundreds of ms of tail behind
// it — the same latent issue chime had before its shimmer was fixed, just never addressed
// for the other 8 families' hover. Click keeps its family's shimmer as its "solid body";
// hover doesn't get one — it's a weightless probe, not a struck object.
const hoverNote: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false }];

// Compound press+release: press low, solid, weighted; a real gap; then release high,
// brief, crisp — press decays out before release fires rather than overlapping it, so the
// two read as a distinct down-then-up (same shape as paper-snap's exact-match rebuild of
// Cuelume's own separately-triggered press/release pair). Real minor-third interval
// between them (not a ~1-semitone token nudge), release deliberately shorter than press
// (brief, not lingering) rather than the reverse. No pitch sweep on either note — Cuelume's
// own press/release don't sweep at all (static frequency + filter brightness + decay
// length do all the work); forcing a glide into a note this short read as an unstable
// flutter rather than a clean transition. useDelay:false on both — a physical click-clack
// is dry and punchy, not a resonance that should ring on past the gesture.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 0.96, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.32, pitchMultiplier: 1.26, volumeMultiplier: 0.5, useDelay: false },
];

// Mechanical toggle click — down-stroke + a quiet settle, reused by the two "switch-like" families.
const toggleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.55, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.5, lengthFraction: 0.5, pitchMultiplier: 0.94, volumeMultiplier: 0.4 },
];

// The shared "task completed" gesture — a real major-triad-ish arpeggio (root, major
// third, fifth), legato offsets so the notes overlap and ring together rather than
// sounding like separate clicks. This is what a "premium" reward moment actually needs:
// genuine pitch movement, not a flat tick.
const congratsArpeggio: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.22, lengthFraction: 0.44, pitchMultiplier: 1.26, volumeMultiplier: 0.85 },
  { offsetFraction: 0.44, lengthFraction: 0.52, pitchMultiplier: 1.5, volumeMultiplier: 1 },
];

// --- soft-bubble: bespoke per-instance gestures. Leans on the family's existing
// "gimmick" from resolveNoteParams — a sweepTo glide whose magnitude scales with `tone` —
// for a genuine squeeze/bloop quality instead of a flat pitch.

// click (compound press+release, matching paper-snap's exact-match shape): a real gap
// between press and release, not a legato overlap — press decays out before release
// fires, so the two read as a clear down-then-up rather than one blended motion, the same
// relationship as Cuelume's own separately-triggered press/release pair. Dropped the pitch
// sweeps this used to carry on both notes — on a note this short a glide reads as an
// unstable warble rather than a clean transition (the same "vibrato" lesson click's release
// hit earlier this session, just missed here because this family's own sweep gimmick was
// specific to it). Static pitch now, same as every other family's click; the minor-third
// interval plus the texture flick below still carry plenty of "give" and "crisp" without
// needing motion mid-note. useDelay:false on all three — a physical click-clack is dry and
// punchy; this family's shimmer is a "genuine tail" quality that belongs on its warmer
// instances, not a struck/released contact sound that should stop the instant it's done.
const softBubbleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.34, pitchMultiplier: 1.19, volumeMultiplier: 0.5, useDelay: false },
  { offsetFraction: 0.6, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, useDelay: false },
];

// congrats: three bubbles blooping upward — root, major third, fifth — each with its own
// gentle upward sweep, spaced with real room to ring rather than a flat 3-note run.
const softBubbleCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.36, pitchMultiplier: 1, volumeMultiplier: 0.8, sweepTo: 1.05 },
  { offsetFraction: 0.3, lengthFraction: 0.38, pitchMultiplier: 1.26, volumeMultiplier: 0.9, sweepTo: 1.05 },
  { offsetFraction: 0.6, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.05 },
];

// error: soft-bubble's own bright/pleasant timbre was undercutting a plain major-third
// descent — it just read as a pretty little phrase, not "wrong." Rebuilt around 3 explicit
// error-acoustic principles: (1) descending run — kept, but widened to a tritone (0.7071)
// instead of a major third, real dissonance rather than a consonant interval; (2) a genuine
// double-tap knock — two short muted pulses ~36ms apart (mimicking mechanical resistance,
// like a jammed latch) instead of one; (3) the descending pair still lands after both taps,
// so the "obstruction" reads before the "refusal." A touch of soft-bubble's tone-scaled
// give kept on the root tone as family flavor.
// Knock rebalanced quieter than the tones (was the loudest element at 1.0/0.7) — it's a
// decorative/textural accent establishing the "jam" before the real signal, not the
// signal itself; the descending tritone pair should be what actually reads as "error."
const softBubbleErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.55,
    useTexture: { filterType: 'bandpass', filterCutoff: 1000, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.2,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.38,
    useTexture: { filterType: 'bandpass', filterCutoff: 1000, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.35, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.55, useFilter: false, useDelay: false, attack: 0.004, sweepTo: 0.92 },
  { offsetFraction: 0.65, lengthFraction: 0.35, pitchMultiplier: 0.7071, volumeMultiplier: 0.58, useFilter: false, useDelay: false, attack: 0.004 },
];

// toggle: two soft bubbles, a real minor-third step between them.
const softBubbleToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.95 },
  { offsetFraction: 0.46, lengthFraction: 0.54, pitchMultiplier: 1.12, volumeMultiplier: 0.6 },
];

// submit (exact reference match): Cuelume's own "loading" recipe, layer for layer — a soft
// lowpass-noise breath (1400Hz, Q0.6, 35ms attack, 140ms decay) underneath a sine gliding a
// real fifth, 420 -> 630Hz (1 -> 1.5x), 25ms attack, 180ms decay. Uses the new per-note
// attack override and inline noise-filter override specifically so this one instance can
// carry a genuinely slow "swell" attack and its own soft noise character — soft-bubble's
// own textureLayer is tuned as a bright bandpass flick for click's release, the wrong
// character for a breath. tone is set to 1.0 so soft-bubble's tone-scaled sweep gimmick
// doesn't attenuate the fifth — this is the one instance that wants the full, unscaled
// glide, not a softened one. Volumes solved to match Cuelume's own post-gain-stage
// amplitudes (~0.084 tone / ~0.059 noise), the same approach used for chime's exact-match
// congrats baseline earlier in this project.
const softBubbleSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.7155, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.8537,
    pitchMultiplier: 1,
    volumeMultiplier: 0.7,
    useTexture: { filterType: 'lowpass', filterCutoff: 1400, filterQ: 0.6 },
    useDelay: false,
    attack: 0.035,
  },
];

// notification: modeled on Cuelume's own "bloom" — "a warm, slow-swelling pad from two
// gently detuned sines." Same pattern at soft-bubble's own 587Hz register: two layers at
// the *same* pitch (no interval, no glide — the movement is purely the detune beating),
// one detuned +12 cents, both with a genuinely slow 60ms attack (the slowest attack of
// anything in this project) and a long ~320-340ms decay. Filter left on — soft-bubble's
// lowpass is already essentially transparent at this register, no need for useFilter:false.
// Shimmer left on too (unlike error/click's useDelay:false elsewhere) — bloom leans on its
// tail for warmth.
const softBubbleNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// --- glass-crystal: bespoke per-instance gestures, leaning into the family's resonant
// highpass — real intervals given room so the resonance can actually ring, rather than
// generic clicks riding on top of the brightness.

// click (compound press+release): press sits at the tap (weighted), then a real gap before
// release jumps to a brighter fourth (crisp) — press decays out before release fires
// rather than overlapping it, so the two read as a distinct down-then-up rather than one
// blended glide (same shape as paper-snap's exact-match rebuild). No pitch sweep — on a
// note this short a glide read as flutter, not a clean interval jump; the resonant highpass
// Q made it worse (a swept pitch passing near the filter's own resonant peak rings/wobbles).
// The static fourth plus the texture flick below carry "crisp" now. useDelay:false on all
// three — a physical click-clack is dry and punchy, not a resonance that should ring on
// past the gesture.
const glassCrystalClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.56, lengthFraction: 0.34, pitchMultiplier: 1.33, volumeMultiplier: 0.45, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, useDelay: false },
];

// congrats: an ascending "ting-ting-TING" — root, fifth, octave — the biggest interval
// jumps of any family's congrats, matching how far a glass resonance actually carries.
const glassCrystalCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.34, pitchMultiplier: 1, volumeMultiplier: 0.75 },
  { offsetFraction: 0.28, lengthFraction: 0.36, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.56, lengthFraction: 0.44, pitchMultiplier: 2, volumeMultiplier: 1 },
];

// toggle: a real two-part crystalline click-clack, a genuine descending fourth.
const glassCrystalToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.45, lengthFraction: 0.55, pitchMultiplier: 0.78, volumeMultiplier: 0.7 },
];

// submit: same loading-recipe structure as soft-bubble's exact match (slow-attack tone
// glide + soft lowpass breath, no shimmer on the breath), tuned to glass-crystal's own
// register and filter safety instead of copying soft-bubble's numbers. pitchMultiplier
// 0.8 keeps the tone comfortably above this family's highpass cutoff at submit's own tone
// value (0.45 -> ~702Hz cutoff; 0.8x = ~837Hz start, clear margin) — the same safety
// margin every other glass-crystal instance already respects.
const glassCrystalSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.8, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 1900, filterQ: 1 },
    useDelay: false,
    attack: 0.03,
  },
];

// notification: same bloom pattern as soft-bubble — two same-pitch sines, one detuned +12
// cents, 60ms attack, long decay, no glide. useFilter:false keeps it a clean static tone
// (this family's own highpass is safe here regardless, but consistent with how every
// other clean tone in this family is handled).
const glassCrystalNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, useFilter: false, detuneCents: 12, attack: 0.06 },
];

// error: glass-crystal's resonant brightness was making a plain major-third descent read
// as a pretty little phrase rather than "wrong." Rebuilt on the same 3 principles as
// soft-bubble: a genuine double-tap knock (two muted pulses ~36ms apart, mimicking a
// jammed mechanism) ahead of the tones, and the descent widened to a real dissonant
// tritone (0.7071) instead of a consonant major third. useFilter:false on the tones still
// sidesteps this family's highpass entirely.
// Knock rebalanced quieter than the tones — decorative accent, not the signal itself.
const glassCrystalErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.55,
    useTexture: { filterType: 'bandpass', filterCutoff: 1800, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.2,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.38,
    useTexture: { filterType: 'bandpass', filterCutoff: 1800, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.35, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.55, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.65, lengthFraction: 0.35, pitchMultiplier: 0.7071, volumeMultiplier: 0.58, useFilter: false, useDelay: false, attack: 0.004 },
];

// --- chime: bespoke per-instance gestures, not the shared templates. Cuelume's own
// chime is two clean unfiltered sine layers a fifth apart, spaced 90ms with 220-260ms
// of individual decay each — the "bell" comes from real interval + room to ring, not
// from more notes packed tighter. Applied here at chime's own register or without
// literally copying their numbers.

// click (compound press+release): press sits at the tap (weighted), then a real gap
// before release jumps a minor third up (crisp) — press decays out before release fires
// instead of overlapping it, echoing how Cuelume's press/release are two separately-
// triggered recipes rather than one sound scaled down (same shape as paper-snap's
// exact-match rebuild). No sweep: Cuelume's own release doesn't glide either, and a
// forced glide on a note this short read as flutter, not a clean interval jump. Texture
// companion pulled way down (0.5 -> 0.08) — at equal volume with the release tone it read
// as a second competing sound instead of press+release reading as exactly two clear hits;
// paper-snap's own exact match keeps its analogous accent at roughly this same fraction of
// its dominant layer.
const chimeClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.56, lengthFraction: 0.34, pitchMultiplier: 1.19, volumeMultiplier: 0.5, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.08, useTexture: true, useDelay: false },
];

// congrats: baseline matched to Cuelume's own chime recipe — root C6 (1046.5Hz) then a
// fifth up to G6 (1568Hz), second note entering 90ms after the first, each with its own
// attack/decay rather than sharing one envelope. Pitch multipliers are solved against
// chime's 940Hz base register (baseFrequency * congrats' 1.05 instance pitch = 987Hz) so
// the family's shared register doesn't move, only these two notes land on Cuelume's exact
// frequencies.
//
// Each strike also gets a quiet detuned unison companion (same pitch/timing, ±6-7 cents,
// ~35% volume) — real chorus/beating from two real oscillators, rather than asking the
// delay-based shimmer to be the only source of width. Opposite detune direction on the two
// strikes (+7 then -6) so they don't beat identically.
const chimeCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6348, pitchMultiplier: 1.0603, volumeMultiplier: 1 },
  { offsetFraction: 0, lengthFraction: 0.6348, pitchMultiplier: 1.0603, volumeMultiplier: 0.35, detuneCents: 7 },
  { offsetFraction: 0.2528, lengthFraction: 0.7472, pitchMultiplier: 1.5887, volumeMultiplier: 0.8889 },
  { offsetFraction: 0.2528, lengthFraction: 0.7472, pitchMultiplier: 1.5887, volumeMultiplier: 0.311, detuneCents: -6 },
];

// toggle: a real two-part click-clack — a genuine step between the two notes, not a
// barely-there wobble.
const chimeToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.45, lengthFraction: 0.55, pitchMultiplier: 0.82, volumeMultiplier: 0.75 },
];

// submit: same loading-recipe structure, at chime's own transparent-filter register
// (940Hz, no highpass-safety concern the way glass-crystal/tiny-sparkle have).
const chimeSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 1500, filterQ: 1 },
    useDelay: false,
    attack: 0.032,
  },
];

// notification: same bloom pattern, at chime's own 940Hz register — already essentially
// unfiltered by design, so no useFilter override needed.
const chimeNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// error: same knock+2-tone pattern as snap's exact Cuelume match, at chime's own 940Hz
// register.
const chimeErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 1600, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.1, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.35, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.7937, volumeMultiplier: 0.31, useFilter: false, useDelay: false, attack: 0.004 },
];

// paper-snap: reconsidered — a bandpass-noise jump reads as gritty/textured, not the
// bright, clean, airy ascending run this instance needs. Filtered noise can't hold a
// stable, trackable pitch (same lesson as error's descending pair), so the actual
// ascending content now runs on real sine tones (waveformOverride, useFilter:false) — a
// genuine 3-note consonant climb (root, major third, fifth) instead of a 2-note bandpass
// jump. A brief bright noise "snap" opens the gesture for family character — tried also
// layering a quiet noise-grain companion under each landing tone, but noise reads far
// louder than its nominal volume suggests, and threading it through the whole run made
// the papery texture the dominant impression instead of an accent. Pulled back to a
// single opening snap only (register ~0.26 picked for a bright register rather than this
// family's noise-bandpass-tuned 3200Hz base).
const paperSnapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.12, pitchMultiplier: 1.4, volumeMultiplier: 0.4, attack: 0.001 },
  { offsetFraction: 0.06, lengthFraction: 0.34, pitchMultiplier: 0.26, volumeMultiplier: 0.8, waveformOverride: 'sine', useFilter: false, attack: 0.008 },
  { offsetFraction: 0.34, lengthFraction: 0.34, pitchMultiplier: 0.3276, volumeMultiplier: 0.9, waveformOverride: 'sine', useFilter: false, attack: 0.008 },
  { offsetFraction: 0.62, lengthFraction: 0.38, pitchMultiplier: 0.39, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.008 },
];

// paper-snap click (exact reference match): Cuelume's press and release are two
// separately-triggered cues (pointerdown / pointerup), but they're built from the same
// material — bandpass noise, nothing else but one small sine tick — so compounding them
// into a single click reads as one physical down-then-up motion instead of two unrelated
// hits. press: dull muted knock, bandpass noise at 1700Hz/Q1.4. release: brighter springy
// tick, bandpass noise at 4600Hz/Q1.8 plus a tiny 3200Hz sine riding 6ms into it (their own
// offset, kept) — 3200Hz happens to be this family's exact baseFrequency, so that tick note
// needs no register adjustment at all. useTexture's inline filter override reproduces their
// literal cutoffs instead of scaling off this family's own bandpass center, the same
// technique soft-bubble's loading and snap's error already use for their exact matches. No
// shimmer (useDelay:false) — their press/release recipes carry none. Timing compressed into
// a genuine click length (was 15ms; now 90ms) so the knock and the flick both have room to
// read as distinct instead of blurring into one transient.
const paperSnapClickNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.22,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 1700, filterQ: 1.4 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.4,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 0.92,
    useTexture: { filterType: 'bandpass', filterCutoff: 4600, filterQ: 1.8 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.46,
    lengthFraction: 0.5,
    pitchMultiplier: 1,
    volumeMultiplier: 0.15,
    waveformOverride: 'sine',
    useFilter: false,
    useDelay: false,
    attack: 0.001,
  },
];

// paper-snap submit: sweepTo is ignored for noise (the engine never sweeps a bandpass
// center), so "lifting" here is a discrete two-step bandpass rise (root -> a real fifth)
// instead of a continuous glide — the same substitution already used for its congrats/click.
// Doesn't need a separate breath layer (this family's whole voice already is noise); the
// slow attack on both steps is what borrows the loading-recipe "swell" quality instead.
const paperSnapSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.55, pitchMultiplier: 1, volumeMultiplier: 0.85, attack: 0.03 },
  { offsetFraction: 0.4, lengthFraction: 0.6, pitchMultiplier: 1.5, volumeMultiplier: 1, attack: 0.035 },
];

// error: even a high-Q (12) bandpass on noise still didn't produce a genuinely stable,
// trackable pitch — filtered noise always retains some random amplitude/phase wobble
// within the passband, which reads as "ringing" rather than "a tone descending." Every
// other family's error relies on an actual oscillator for this; this family's voice is
// pure noise, so it never had one. Gave these two notes a real sine (waveformOverride),
// raw/unfiltered (useFilter:false) — genuine, stable pitch, root then a real tritone down
// (0.7071, same interval every other family's error uses), now audible the same way
// theirs is. Picked a register (pitchMultiplier ~0.3, landing around 875Hz -> 619Hz) sized
// for an actual tone rather than reusing this family's noise-bandpass-tuned 3200Hz base,
// which would read as unusually shrill for a pitch. The two knocks stay pure noise — this
// family's own percussive character, contrasting against the now-clean tonal descent.
// Knock rebalanced quieter than the tones — decorative accent, not the signal itself.
const paperSnapErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.075, pitchMultiplier: 1.3, volumeMultiplier: 0.55, attack: 0.001 },
  { offsetFraction: 0.2, lengthFraction: 0.075, pitchMultiplier: 1.3, volumeMultiplier: 0.38, attack: 0.001 },
  {
    offsetFraction: 0.35,
    lengthFraction: 0.3,
    pitchMultiplier: 0.3,
    volumeMultiplier: 0.55,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.004,
  },
  {
    offsetFraction: 0.65,
    lengthFraction: 0.35,
    pitchMultiplier: 0.2121,
    volumeMultiplier: 0.58,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.004,
  },
];

// notification: same lesson as error's descending pair — filtered noise can't produce a
// stable pitch to beat/detune against, so bloom's whole "two sines gently detuned" premise
// needs a real oscillator here too (waveformOverride), same as error's tones. Same
// pattern as every other family: same-pitch pair, one detuned +12 cents, 60ms attack, long
// decay, no glide. Register (pitchMultiplier 0.2, ~640Hz) picked for a genuine warm tone
// rather than reusing this family's noise-bandpass-tuned 3200Hz base.
const paperSnapNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.2, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.2, volumeMultiplier: 0.83, waveformOverride: 'sine', useFilter: false, detuneCents: 12, attack: 0.06 },
];

// metallic-tact: three evenly-spaced clicks climbing a fourth then a fifth — a mechanical
// ratchet with a real interval, not three near-identical taps. Reconsidered: routing
// these through this family's own narrow bandpass (the source of its "metallic" identity
// everywhere else) read as buzzy/mechanical, not the bright, clean, airy run this instance
// needs — same lesson as notification. waveformOverride:'sine' + useFilter:false carries
// the pitch; a quiet useTexture:true companion at each note (this family's own 4200Hz
// bandpass sheen, same layer the click release uses for its metallic ping) rides
// underneath so the run still reads as metallic-tact, not a generic clean sine.
const metallicTactCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.22, useTexture: true },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.9, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.24, useTexture: true },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 0.26, useTexture: true },
];

// metallic-tact click (compound press+release): press sits low (mechanical, "the key
// bottoming out"), a real gap, then release pings up a real interval ("the key returning")
// with a bright metallic-sheen texture flick for the crispness — press decays out before
// release fires rather than overlapping it, the clearest fit of any family for this shape
// given the family's own mechanical-tactile identity (same as paper-snap's exact-match
// rebuild of Cuelume's separately-triggered press/release pair). No sweep — a glide
// squeezed this short read as flutter rather than a clean ping. useDelay:false on all
// three — a mechanical key strike is dry and punchy, not a resonance that rings on.
const metallicTactClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 0.96, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.56, lengthFraction: 0.32, pitchMultiplier: 1.28, volumeMultiplier: 0.5, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.28, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, useDelay: false },
];

// submit: same loading-recipe structure, at metallic-tact's own register — the square
// wave's odd-harmonic content still carries through its narrow bandpass same as every
// other instance in this family.
const metallicTactSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 1600, filterQ: 1 },
    useDelay: false,
    attack: 0.03,
  },
];

// notification: reconsidered — a raw unfiltered square wave is never "warm," it just
// trades the family's usual filtered harshness for a different, unfiltered harshness (all
// those odd harmonics are still there). "Warm, subtle chorusing, ambient" is fundamentally
// a sine-wave quality, so this instance specifically breaks from the family's own
// waveform (waveformOverride:'sine', same technique already used for paper-snap's error).
// Register dropped too (pitchMultiplier 0.85, ~666Hz) — this family's usual 784Hz+
// register reads as present/tactile, not the deeper, room-filling register bloom implies.
// Detune widened slightly (12 -> 15 cents) for a more perceptible chorus depth.
const metallicTactNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.85, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.85, volumeMultiplier: 0.83, waveformOverride: 'sine', useFilter: false, detuneCents: 15, attack: 0.06 },
  // quiet metallic sheen riding under the pad (this family's own texture layer, slow
  // attack to match the swell) — keeps a trace of family identity without reintroducing
  // the harshness the sine override was meant to remove.
  { offsetFraction: 0, lengthFraction: 0.9, pitchMultiplier: 0.85, volumeMultiplier: 0.14, useTexture: true, attack: 0.08 },
];

// error: same knock+2-tone pattern as snap's exact Cuelume match, at metallic-tact's own
// 784Hz register. Reconsidered from the original design: keeping the tones routed through
// this family's own narrow (Q12) bandpass made the compound read as an indistinct buzz
// rather than two clear descending tones — the fundamental sits well below the passband,
// leaning on harmonics alone wasn't enough to carry a legible pitch at this short a length.
// useFilter:false now (raw square tones); the knock's own filtered texture still carries
// enough family character. Also lengthened (130ms -> 170ms) and the tones' volume raised
// so all three parts have real room to register instead of blurring together.
const metallicTactErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 1350, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.1, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.45, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.7937, volumeMultiplier: 0.4, useFilter: false, useDelay: false, attack: 0.004 },
];

// digital-blip: reconsidered — this family's own bandpass coloring plus a 2-note jump
// (with a wobbly landing sweep) read as a "blip," not the bright, clean, airy ascending
// run this instance needs. waveformOverride:'sine' + useFilter:false, expanded to a
// genuine 3-note consonant climb (root, major third, fifth) for real ascending motion, no
// sweep (clean landing instead of a wobble). Register raised (pitchMultiplier ~2.2, vs
// this family's usual ~1x) — its native 360Hz base reads as warm/low, not bright, once
// it's a clean sine rather than a filtered square. A quiet useTexture:true companion rides
// under each tone — the same "grit" layer hover/click already use — so the run keeps this
// family's digital edge instead of sounding like a generic clean sine climb.
const digitalBlipCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 2.2, volumeMultiplier: 0.8, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 2.2, volumeMultiplier: 0.28, useTexture: true },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 2.772, volumeMultiplier: 0.9, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 2.772, volumeMultiplier: 0.3, useTexture: true },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 3.3, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 3.3, volumeMultiplier: 0.32, useTexture: true },
];
// hover/click keep a quick, quiet click layered under the square tone for a little grit.
const digitalBlipHoverNotes: Note[] = [
  ...hoverNote,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.35, useTexture: true },
];
// Two texture notes (a grit bed under the whole gesture, plus a separate flick on release)
// piled on top of the two tone notes made this read as more than a press+release compound
// — four audible layers instead of two clear hits. Collapsed to one quiet accent on
// release only, matching the treatment every other family's click uses now: paper-snap's
// own exact match is the model — press and release should read as exactly two sounds, with
// any texture underneath staying a subordinate color, not a competing third layer.
const digitalBlipClickNotes: Note[] = [
  ...clickNotes,
  { offsetFraction: 0.58, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.08, useTexture: true, useDelay: false },
];

// submit: same loading-recipe structure, at digital-blip's own low 360Hz register — the
// breath's cutoff is pulled down to match rather than reusing a register tuned for a
// family sitting an octave-plus higher.
const digitalBlipSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 900, filterQ: 1 },
    useDelay: false,
    attack: 0.03,
  },
];

// notification: reconsidered, same reasoning as metallic-tact — raw square is still
// harsh, not warm, no matter the filtering. waveformOverride:'sine' here too. 360Hz was
// already a low, reasonably warm register, so no pitch change needed, just the waveform
// and the same widened detune (15 cents) for more perceptible chorus depth.
const digitalBlipNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, waveformOverride: 'sine', useFilter: false, detuneCents: 15, attack: 0.06 },
  // quiet digital grit riding under the pad, slow attack to match the swell — keeps this
  // family's own texture legible without reintroducing raw-square harshness.
  { offsetFraction: 0, lengthFraction: 0.9, pitchMultiplier: 1, volumeMultiplier: 0.13, useTexture: true, attack: 0.08 },
];

// error: same knock+2-tone pattern as snap's exact Cuelume match, at digital-blip's own
// low 360Hz register. Reconsidered: filtered tones plus a short length made the compound
// read as one indistinct blip rather than a clear descending pair — switched to
// useFilter:false (raw square tones) and lengthened (120ms -> 160ms) with the tones'
// volume raised so all three parts have real room to register.
const digitalBlipErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 620, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.1, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.45, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.7937, volumeMultiplier: 0.4, useFilter: false, useDelay: false, attack: 0.004 },
];

// --- spring: bespoke per-instance gestures built around a real physical overshoot —
// compress, then rebound past rest before settling — using sweepTo for the rebound rather
// than a flat second pitch.

// click: compress down, a beat for the compression to fully settle, then rebound
// overshoots upward — a genuine spring release, not a static two-note click. Dropped the
// pitch sweeps this used to ride on both notes (compress 1->0.82, rebound 0.94->1.28*0.94)
// — on notes this short they read as an unstable warble rather than a clean physical
// motion, the same "vibrato" lesson click's release hit elsewhere this session. The
// "overshoot past rest" idea now comes from a static interval instead — press sits below
// rest (0.9), release lands above it (1.15) — so press and release still read as two clear,
// static-pitch hits, just at registers that imply the compress/rebound without a glide.
// Widened the gap between compress and rebound (same "let press decay out before release
// fires" principle behind every other family's compound click) so the settle reads as a
// real pause. useDelay:false on all three — a physical contact sound is dry and punchy,
// not a resonance that should ring on past the gesture. Texture companion pulled way down
// (0.5 -> 0.08) — at equal volume with the release tone it read as a second competing
// sound; paper-snap's exact match is the model for "press+release as exactly two clear
// hits," with any texture staying a subordinate color underneath.
const springClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 0.9, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.5, lengthFraction: 0.42, pitchMultiplier: 1.15, volumeMultiplier: 0.55, useDelay: false },
  { offsetFraction: 0.5, lengthFraction: 0.28, pitchMultiplier: 1, volumeMultiplier: 0.08, useTexture: true, useDelay: false },
];

// submit: the loading-recipe structure (slow-attack tone + soft breath), but with a small
// overshoot past the fifth before it would settle — spring's own physical signature kept
// on top of the shared structure rather than a plain, unadorned glide.
const springSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.58, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 1100, filterQ: 1 },
    useDelay: false,
    attack: 0.032,
  },
];

// notification (exact reference match): Cuelume's own "bloom" recipe, layer for layer —
// spring's 520Hz base sits almost exactly on bloom's own 528Hz (pitchMultiplier 1.0154
// lands there precisely), the closest register match of any family for any Cuelume recipe
// ported so far. Two sine layers at the same pitch, one detuned +12 cents (their exact
// detune amount) — no interval, no glide, the only movement is the detune beating. 60ms
// attack (their exact value, the slowest attack in this whole project), decay long enough
// that each layer's own total (380ms/400ms) matches their 320ms/340ms decay + attack.
// Filter left on (spring's lowpass is already essentially transparent this low); shimmer
// left on too — bloom leans on its own genuine tail for warmth, unlike error's dry knocks.
const springNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1.0154, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1.0154, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// congrats: a bouncy ascending run (root, fourth, fifth) where the final note overshoots
// upward before relaxing — the spring settling past its target, not a clean landing.
// useFilter:false on all three: the family's lowpass cutoff is computed once from `tone`
// and held fixed across the whole gesture, so as these notes climb toward and past it
// (691Hz/780Hz against a ~722Hz cutoff at this preset's tone) it was quietly muffling
// exactly the notes that needed to sound brighter, undercutting the ascent instead of
// letting it read.
const springCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.32, pitchMultiplier: 1, volumeMultiplier: 0.8, useFilter: false },
  { offsetFraction: 0.26, lengthFraction: 0.34, pitchMultiplier: 1.33, volumeMultiplier: 0.85, useFilter: false },
  { offsetFraction: 0.52, lengthFraction: 0.48, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.08, useFilter: false },
];

// Same knock+2-tone pattern as snap's exact Cuelume match, at spring's own 520Hz register,
// with its own compressed "boing-down" sweep kept on both tones rather than replaced.
const springErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 900, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.1, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.35, useFilter: false, useDelay: false, attack: 0.004, sweepTo: 0.85 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.7937, volumeMultiplier: 0.31, useFilter: false, useDelay: false, attack: 0.004, sweepTo: 0.9 },
];

// toggle: click + a small springy rebound step.
const springToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.48, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.9 },
  { offsetFraction: 0.44, lengthFraction: 0.56, pitchMultiplier: 1.19, volumeMultiplier: 0.55 },
];

// --- tiny-sparkle: bespoke per-instance gestures — quick, bright, and light, distinct
// from every other family's timing by being genuinely fast rather than just quiet.

// click (compound press+release): a very light two-part twinkle — press sits at the root,
// a brief gap, then release leaps a real fifth up and stays the shorter of the two notes —
// press decays out before release fires rather than overlapping it, same shape as every
// other family's compound click this pass, just kept the tightest of all of them to match
// this family's genuinely-fast identity. No sweep: nowhere near long enough for a glide to
// read as anything but flutter — the fifth interval alone already carries plenty of "up."
// useDelay:false on all three — dry and punchy, no ring-on. Texture companion pulled way
// down (0.5 -> 0.08) — at equal volume with the release tone it read as a second competing
// sound rather than press+release landing as exactly two clear hits, paper-snap's own
// exact match being the model for that.
const tinySparkleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false },
  { offsetFraction: 0.56, lengthFraction: 0.32, pitchMultiplier: 1.5, volumeMultiplier: 0.5, useDelay: false },
  { offsetFraction: 0.58, lengthFraction: 0.28, pitchMultiplier: 1, volumeMultiplier: 0.08, useTexture: true, useDelay: false },
];

// congrats: tuned toward Cuelume's own sparkle recipe — root/third/fifth/octave was
// already our interval choice, and it turns out to be exactly theirs too (1760/2217/
// 2637/3520Hz reduce to the same 1/1.26/1.5/2 ratios). Two things weren't: their notes
// enter on even 45ms spacing with each note's own decay actually growing (90/90/100/120ms)
// rather than our proportionally-fixed fractions, and — the real character difference —
// they diminuendo (first note loudest, each next one quieter: 1.0/0.89/0.84/0.71). Ours
// crescendo'd toward the octave, which reads as "building up" rather than Cuelume's "one
// clear hit scattering into shimmer." offsetFraction/lengthFraction below are solved
// against a 280ms total so the raw timing matches their real ms values.
const tinySparkleCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3214, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.1607, lengthFraction: 0.3214, pitchMultiplier: 1.26, volumeMultiplier: 0.89 },
  { offsetFraction: 0.3214, lengthFraction: 0.3571, pitchMultiplier: 1.5, volumeMultiplier: 0.84 },
  { offsetFraction: 0.4821, lengthFraction: 0.4286, pitchMultiplier: 2, volumeMultiplier: 0.71 },
];

// toggle: quick light click-clack, a real descending major third.
const tinySparkleToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.46, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.79, volumeMultiplier: 0.6 },
];

// submit: same loading-recipe structure, quickest attacks of any family (still well clear
// of flutter territory, matching this family's own established "fast" identity). Preset
// tone is pinned low (0.1) rather than this family's usual mid-range — its highpass cutoff
// climbs to 2240Hz at tone=1, and pitchMultiplier 1.15 only clears the cutoff at this low
// tone value; going any higher risked the same silence bug glass-crystal's highpass had.
const tinySparkleSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1.15, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.02 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 2200, filterQ: 1 },
    useDelay: false,
    attack: 0.025,
  },
];

// notification: reconsidered — this family's own bright 1040Hz+ register (already
// unfiltered, sine, so timbre wasn't the issue) reads as shimmery/glassy, not the deeper,
// room-filling warmth bloom implies. Register dropped for this instance specifically
// (pitchMultiplier 0.55, ~572Hz) — a deliberate break from tiny-sparkle's usual bright
// identity, same as every other family's notification prioritizing "warm" over its own
// default character here. Detune widened (12 -> 15 cents) for more perceptible depth.
// useFilter:false still sidesteps this family's highpass.
const tinySparkleNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.55, volumeMultiplier: 1, useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.55, volumeMultiplier: 0.83, useFilter: false, detuneCents: 15, attack: 0.06 },
];

// error: tiny-sparkle's delicate brightness had the same problem as glass-crystal/
// soft-bubble — a plain major-third descent read as pretty, not "wrong." Rebuilt with a
// genuine double-tap knock (two muted pulses ~34ms apart) and the descent widened to a
// real dissonant tritone (0.7071). useFilter:false on the tones still sidesteps this
// family's highpass entirely.
// Knock rebalanced quieter than the tones — decorative accent, not the signal itself.
const tinySparkleErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.55,
    useTexture: { filterType: 'bandpass', filterCutoff: 1800, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.19,
    lengthFraction: 0.075,
    pitchMultiplier: 1,
    volumeMultiplier: 0.38,
    useTexture: { filterType: 'bandpass', filterCutoff: 1800, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.34, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.6, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.64, lengthFraction: 0.36, pitchMultiplier: 0.7071, volumeMultiplier: 0.63, useFilter: false, useDelay: false, attack: 0.004 },
];

// snap: a real fourth-ish jump on the second hit — still snappy, but with somewhere to land.
const snapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.36, lengthFraction: 0.5, pitchMultiplier: 1.33, volumeMultiplier: 1 },
];

// snap click (compound press+release): press sits low (weighted), a real gap, then
// release snaps up a real fourth with a bright texture flick for the crispness — press
// decays out before release fires rather than overlapping it, same shape as paper-snap's
// exact-match rebuild of Cuelume's own separately-triggered press/release pair. No sweep —
// a glide had no room to read as anything but flutter. Texture companion pulled way down
// (0.5 -> 0.08) — at equal volume with the release tone it read as a second competing
// sound rather than press+release landing as exactly two clear hits, paper-snap's own
// exact match being the model for that.
const snapClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 0.96, volumeMultiplier: 1 },
  { offsetFraction: 0.56, lengthFraction: 0.32, pitchMultiplier: 1.3, volumeMultiplier: 0.5 },
  { offsetFraction: 0.58, lengthFraction: 0.26, pitchMultiplier: 1, volumeMultiplier: 0.08, useTexture: true },
];

// submit: same loading-recipe structure, at snap's own triangle-wave register.
const snapSubmitNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 1.5, attack: 0.025 },
  {
    offsetFraction: 0,
    lengthFraction: 0.85,
    pitchMultiplier: 1,
    volumeMultiplier: 0.65,
    useTexture: { filterType: 'lowpass', filterCutoff: 1400, filterQ: 1 },
    useDelay: false,
    attack: 0.03,
  },
];

// notification: reconsidered — a raw unfiltered triangle is softer than square but still
// not sine-warm (it keeps real odd-harmonic bite). waveformOverride:'sine' here too, same
// as metallic-tact/digital-blip, with the register nudged down slightly (pitchMultiplier
// 0.9, ~648Hz) and detune widened (12 -> 15 cents) for more perceptible chorus depth.
const snapNotificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.9, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.9, volumeMultiplier: 0.83, waveformOverride: 'sine', useFilter: false, detuneCents: 15, attack: 0.06 },
  // quiet texture companion (this family's own bandpass layer, slow attack) — keeps a
  // trace of snap's own voice under the warm pad instead of a fully generic sine.
  { offsetFraction: 0, lengthFraction: 0.9, pitchMultiplier: 0.9, volumeMultiplier: 0.13, useTexture: true, attack: 0.08 },
];

// error (exact reference match): Cuelume's own error recipe, layer for layer. It's the
// only family recipe of theirs built on triangle-wave tones — snap is our only
// triangle-waveform family, an unambiguous fit the same way soft-bubble was for loading.
// A bandpass-noise knock (850Hz, Q1.1, 1ms attack, 35ms decay, the loudest layer) then two
// raw unfiltered triangle tones: A4 (440Hz) at 25ms, then F4 (349.23Hz, a real major third
// down — 0.7937, Cuelume's exact interval) at 100ms. useFilter:false on both tones matters
// here specifically — snap's own bandpass centers at 720-1620Hz, well above these
// reference frequencies, and Cuelume's tone layers were never filtered in the first place.
// No shimmer anywhere (useDelay:false on all three) — their error recipe has none.
// Volumes solved to match their exact post-gain-stage amplitudes (knock ~0.218, tones
// ~0.076/0.067), the same approach used for chime and soft-bubble's exact matches.
const snapErrorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.1475,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 850, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  {
    offsetFraction: 0.1025,
    lengthFraction: 0.3852,
    pitchMultiplier: 0.6717,
    volumeMultiplier: 0.3462,
    useFilter: false,
    useDelay: false,
    attack: 0.004,
  },
  {
    offsetFraction: 0.4098,
    lengthFraction: 0.5902,
    pitchMultiplier: 0.5331,
    volumeMultiplier: 0.3077,
    useFilter: false,
    useDelay: false,
    attack: 0.004,
  },
];

export const FAMILY_RECIPES: Record<SoundFamily, FamilyRecipe> = {
  'soft-bubble': {
    waveform: 'sine',
    baseFrequency: 587, // D5
    filterType: 'lowpass',
    filterCutoffRange: [1200, 2600],
    filterQ: 0.8,
    delay: { time: 0.09, feedback: 0.22, wet: 0.18, lowpass: 2800 },
    // Bright noise "glint" for click's release — Cuelume's release recipe is mostly a
    // bright filtered-noise flick, not a pitch sweep; a pure sine sweep alone can't
    // produce that broadband crispness. Kept quiet/brief, an accent under the tonal sweep.
    textureLayer: { filterType: 'bandpass', filterCutoff: 3200, filterQ: 2.5, volumeMultiplier: 0.42, lengthFraction: 0.24 },
  },
  'glass-crystal': {
    waveform: 'sine',
    baseFrequency: 1046, // C6
    filterType: 'highpass',
    // Kept below the 1046Hz fundamental across the practical pitch range so a highpass
    // on a pure sine actually passes signal (see engine notes from the volume fix).
    filterCutoffRange: [500, 950],
    // Pushed more resonant than tiny-sparkle's (which went the opposite way, toward
    // broadband) — this is the family's actual distinguishing character now: a narrow,
    // singing resonant peak, not just "highpass + shimmer" shared with tiny-sparkle.
    qRange: [2.5, 11],
    // Slower, longer shimmer than tiny-sparkle — one spacious ring, not a flurry of
    // glints. Tail lands near chime's (~0.78s vs ~0.72s) rather than exceeding every other
    // family's, which would risk the same always-heavy problem chime's gain staging fixed.
    delay: { time: 0.13, feedback: 0.24, wet: 0.22, lowpass: 4200 },
    pitchRange: [0.7, 1.8],
    textureLayer: { filterType: 'bandpass', filterCutoff: 5400, filterQ: 3, volumeMultiplier: 0.42, lengthFraction: 0.22 },
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
    // Short comb-like metallic ring — a real physical resonance, not just a click.
    delay: { time: 0.002, feedback: 0.28, wet: 0.4, lowpass: 3800 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 4, volumeMultiplier: 0.42, lengthFraction: 0.22 },
  },
  chime: {
    waveform: 'sine',
    baseFrequency: 940,
    // Cuelume's own chime is completely unfiltered sine — filtering was adding nothing
    // but a slight dulling. Widened well above anything chime ever plays so it stays
    // essentially transparent at any tone value; `tone` keeps a token effect rather than
    // being removed outright.
    filterType: 'lowpass',
    filterCutoffRange: [2400, 6000],
    filterQ: 0.7,
    // Matched exactly to Cuelume's own chime shimmer for the reference baseline below —
    // brighter feedback lowpass than our other families' shimmer (4000 vs ~3200) so the
    // repeats stay airy instead of darkening into a dull wash.
    delay: { time: 0.12, feedback: 0.25, wet: 0.18, lowpass: 4000 },
    // 4600Hz — happens to land close to Cuelume's own release noise center; a coincidence
    // of both of us picking "bright glint above the tonal register," not a copied number.
    textureLayer: { filterType: 'bandpass', filterCutoff: 4600, filterQ: 2.5, volumeMultiplier: 0.4, lengthFraction: 0.24 },
  },
  'digital-blip': {
    waveform: 'square',
    baseFrequency: 360,
    filterType: 'bandpass',
    filterCutoffRange: [360, 880],
    filterQ: 5,
    delay: { time: 0.02, feedback: 0.18, wet: 0.16, lowpass: 4200 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 5, volumeMultiplier: 0.32, lengthFraction: 0.25 },
  },
  spring: {
    waveform: 'sine',
    baseFrequency: 520,
    filterType: 'lowpass',
    filterCutoffRange: [520, 940],
    qRange: [1, 5], // resonance bump scales with tone
    delay: { time: 0.07, feedback: 0.25, wet: 0.18, lowpass: 3200 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 2900, filterQ: 2.5, volumeMultiplier: 0.42, lengthFraction: 0.24 },
  },
  'tiny-sparkle': {
    waveform: 'sine',
    baseFrequency: 1040,
    filterType: 'highpass',
    filterCutoffRange: [1040, 2240],
    // Pushed toward broadband/airy rather than glass-crystal's resonant peak — no single
    // "singing" frequency, just an open, breathy brightness. This is the actual
    // differentiator between the two now; before, both families used near-identical
    // highpass+moderate-Q, which is most of why they read as interchangeable.
    qRange: [0.6, 2.5],
    // Nudged toward Cuelume's own sparkle shimmer, then pushed further — faster and denser
    // than glass-crystal's single slow ring, more like a flurry of quick glints.
    delay: { time: 0.045, feedback: 0.4, wet: 0.26, lowpass: 6200 },
    textureLayer: { filterType: 'bandpass', filterCutoff: 6200, filterQ: 3, volumeMultiplier: 0.4, lengthFraction: 0.2 },
  },
  snap: {
    waveform: 'triangle',
    baseFrequency: 720,
    filterType: 'bandpass',
    filterCutoffRange: [720, 1620],
    filterQ: 3.5,
    textureLayer: { filterType: 'bandpass', filterCutoff: 3600, filterQ: 3, volumeMultiplier: 0.42, lengthFraction: 0.22 },
  },
};

// Pitch offsets applied uniformly across families per instance. hover and click keep their
// established split (hover sits above the family's home register, light/weightless; click
// sits into it, grounded) — that contrast wasn't the issue.
//
// congrats is deliberately kept as the family's bright peak (its own note-level intervals
// already climb up to an octave above this baseline — see e.g. glassCrystalCongratsNotes).
// What was wrong: click and especially error sat far enough below congrats's baseline, and
// their own note-level intervals compound further downward from there, that the family's
// overall register spread (error's lowest note to congrats's highest) could reach 1.5-1.7
// octaves — wide enough to stop reading as one voice. Raised click and error toward the
// family's center so they still stay clearly the "grounded"/"muted" instances relative to
// hover and congrats, just without dragging the whole family's floor down so far.
const INSTANCE_PITCH: Record<SoundInstance, number> = {
  hover: 1.08,
  click: 0.96,
  congrats: 1.05,
  error: 0.91,
  toggle: 1.0,
  // Neutral start — the fifth-glide each family's own submit notes carry it upward regardless.
  submit: 1.0,
  // Neutral — bloom has no directional pitch movement at all, just a static detuned pair.
  notification: 1.0,
};

function preset(volume: number, length: number, tone: number, instance: SoundInstance, notes: Note[]): InstancePreset {
  return { volume, length, tone, pitch: INSTANCE_PITCH[instance], notes };
}

// Every family below (chime already fixed separately) had congrats/press/toggle sitting
// at or above the shared limiter's -8dB (~0.4 linear) threshold — the same "always-on
// compression" problem diagnosed on chime, just not yet applied everywhere. Volumes here
// are scaled down proportionally per family (relative loudness between a family's own
// instances preserved) so the loudest instance in each family lands around 0.28-0.30,
// comfortably under threshold even with an arpeggio's overlapping notes — the limiter goes
// back to being a genuine polyphony safety net instead of shaping every single trigger.
export const PRESETS: Record<SoundFamily, Record<SoundInstance, InstancePreset>> = {
  'soft-bubble': {
    hover: preset(0.18, 0.011, 0.45, 'hover', hoverNote),
    click: preset(0.24, 0.055, 0.42, 'click', softBubbleClickNotes),
    // 220ms, up from 160ms — 3 real-interval notes need more room than the old flat
    // arpeggio timing gave them.
    congrats: preset(0.3, 0.22, 0.5, 'congrats', softBubbleCongratsNotes),
    // 140ms, up from 55ms — a 3-element compound (knock + 2 tones) needs real room; the
    // old single swept note fit in 55ms because it was just one continuous motion.
    error: preset(0.22, 0.2, 0.25, 'error', softBubbleErrorNotes),
    toggle: preset(0.22, 0.026, 0.42, 'toggle', softBubbleToggleNotes),
    // high tone so the tone-scaled sweep gimmick still delivers a real fifth-ish lift
    // rather than a token wobble (softBubble's sweep magnitude scales with tone).
    submit: preset(0.084, 0.205, 1.0, 'submit', softBubbleSubmitNotes),
    notification: preset(0.2, 0.4, 0.5, 'notification', softBubbleNotificationNotes),
  },
  'glass-crystal': {
    hover: preset(0.18, 0.009, 0.55, 'hover', hoverNote),
    click: preset(0.24, 0.045, 0.5, 'click', glassCrystalClickNotes),
    congrats: preset(0.3, 0.22, 0.65, 'congrats', glassCrystalCongratsNotes),
    error: preset(0.22, 0.195, 0.3, 'error', glassCrystalErrorNotes),
    toggle: preset(0.23, 0.024, 0.5, 'toggle', glassCrystalToggleNotes),
    submit: preset(0.22, 0.18, 0.45, 'submit', glassCrystalSubmitNotes),
    notification: preset(0.2, 0.4, 0.3, 'notification', glassCrystalNotificationNotes),
  },
  'paper-snap': {
    hover: preset(0.17, 0.008, 0.5, 'hover', hoverNote),
    click: preset(0.26, 0.09, 0.5, 'click', paperSnapClickNotes),
    // 220ms, up from 110ms — matches the broader congrats pack now that this is a real
    // 3-note ascending run instead of a 2-note bandpass jump.
    congrats: preset(0.3, 0.22, 0.55, 'congrats', paperSnapCongratsNotes),
    error: preset(0.22, 0.195, 0.3, 'error', paperSnapErrorNotes),
    toggle: preset(0.22, 0.014, 0.5, 'toggle', singleNote),
    submit: preset(0.21, 0.16, 0.5, 'submit', paperSnapSubmitNotes),
    notification: preset(0.2, 0.4, 0.3, 'notification', paperSnapNotificationNotes),
  },
  'metallic-tact': {
    hover: preset(0.18, 0.012, 0.45, 'hover', hoverNote),
    click: preset(0.24, 0.06, 0.45, 'click', metallicTactClickNotes),
    // 220ms, up from 140ms — matches the broader congrats pack.
    congrats: preset(0.3, 0.22, 0.5, 'congrats', metallicTactCongratsNotes),
    error: preset(0.22, 0.17, 0.3, 'error', metallicTactErrorNotes),
    toggle: preset(0.24, 0.02, 0.45, 'toggle', toggleClickNotes),
    submit: preset(0.22, 0.18, 0.45, 'submit', metallicTactSubmitNotes),
    notification: preset(0.15, 0.4, 0.3, 'notification', metallicTactNotificationNotes),
  },
  chime: {
    // Volumes pulled well below the shared limiter's -8dB (~0.4) threshold — Cuelume's
    // chime notes land around 0.16-0.18 after their own gain staging, comfortably under
    // their limiter too, so a single note never gets compressed. Ours were sitting at or
    // above threshold, so the limiter was squashing almost every chime hit — that
    // gain-reduction pumping is what read as "heavy" next to their untouched transients.
    hover: preset(0.18, 0.012, 0.5, 'hover', hoverNote),
    click: preset(0.23, 0.06, 0.5, 'click', chimeClickNotes),
    // 0.18 volume + 356ms length: solved to land at the exact same final amplitude
    // (~0.18/0.16 post-limiter-headroom) and total decay time as Cuelume's own two chime
    // layers (226ms + 266ms decay, second note entering at the 90ms mark) — see
    // chimeCongratsNotes above for the rest of the mapping.
    congrats: preset(0.18, 0.356, 0.55, 'congrats', chimeCongratsNotes),
    error: preset(0.21, 0.16, 0.28, 'error', chimeErrorNotes),
    toggle: preset(0.23, 0.028, 0.5, 'toggle', chimeToggleNotes),
    submit: preset(0.2, 0.2, 0.45, 'submit', chimeSubmitNotes),
    notification: preset(0.2, 0.4, 0.5, 'notification', chimeNotificationNotes),
  },
  'digital-blip': {
    hover: preset(0.17, 0.009, 0.4, 'hover', digitalBlipHoverNotes),
    click: preset(0.23, 0.035, 0.4, 'click', digitalBlipClickNotes),
    // 220ms, up from 120ms — matches the broader congrats pack now that this is a real
    // 3-note ascending run instead of a 2-note jump.
    congrats: preset(0.3, 0.22, 0.45, 'congrats', digitalBlipCongratsNotes),
    error: preset(0.22, 0.16, 0.25, 'error', digitalBlipErrorNotes),
    toggle: preset(0.22, 0.014, 0.4, 'toggle', toggleClickNotes),
    submit: preset(0.2, 0.16, 0.4, 'submit', digitalBlipSubmitNotes),
    notification: preset(0.15, 0.4, 0.4, 'notification', digitalBlipNotificationNotes),
  },
  spring: {
    hover: preset(0.18, 0.011, 0.45, 'hover', hoverNote),
    click: preset(0.24, 0.05, 0.42, 'click', springClickNotes),
    congrats: preset(0.3, 0.22, 0.48, 'congrats', springCongratsNotes),
    error: preset(0.22, 0.14, 0.28, 'error', springErrorNotes),
    toggle: preset(0.23, 0.027, 0.42, 'toggle', springToggleNotes),
    submit: preset(0.22, 0.2, 0.45, 'submit', springSubmitNotes),
    // exact reference match to Cuelume's bloom — see springNotificationNotes.
    notification: preset(0.12, 0.4, 0.45, 'notification', springNotificationNotes),
  },
  'tiny-sparkle': {
    hover: preset(0.15, 0.008, 0.2, 'hover', hoverNote),
    click: preset(0.22, 0.032, 0.2, 'click', tinySparkleClickNotes),
    // 280ms — matches Cuelume's own sparkle's real total span (last note starts at 135ms,
    // decays 120ms, ≈255ms) now that the notes carry their real individual decay times
    // instead of a compressed fixed fraction. Volume kept in family (still the loudest of
    // tiny-sparkle's own 5 instances, same as every other family's congrats) rather than
    // matching Cuelume's sparkle-is-half-as-loud-as-their-chime ratio — that ratio compares
    // two different Cuelume recipes, not analogous to congrats vs. its own family's hover.
    congrats: preset(0.28, 0.28, 0.32, 'congrats', tinySparkleCongratsNotes),
    error: preset(0.2, 0.19, 0.12, 'error', tinySparkleErrorNotes),
    toggle: preset(0.2, 0.022, 0.2, 'toggle', tinySparkleToggleNotes),
    // shortest submit of any family, still well clear of flutter territory (150ms vs
    // click's 6ms release), matching tiny-sparkle's own "quick" identity. tone pinned to
    // 0.1 — see tinySparkleSubmitNotes for why (highpass-cutoff safety).
    submit: preset(0.19, 0.15, 0.1, 'submit', tinySparkleSubmitNotes),
    notification: preset(0.15, 0.4, 0.1, 'notification', tinySparkleNotificationNotes),
  },
  snap: {
    hover: preset(0.18, 0.009, 0.5, 'hover', hoverNote),
    click: preset(0.24, 0.05, 0.5, 'click', snapClickNotes),
    // 160ms, up from 100ms — was genuinely the shortest congrats of any family (next
    // shortest was paper-snap at 110ms), not giving the fourth-interval jump room to land.
    congrats: preset(0.3, 0.16, 0.55, 'congrats', snapCongratsNotes),
    // 244ms and 0.2184 volume: exact reference match — see snapErrorNotes. tone is unused
    // (neither tone note reads the interpolated filter now), kept at a neutral value.
    error: preset(0.2184, 0.244, 0.3, 'error', snapErrorNotes),
    toggle: preset(0.23, 0.014, 0.5, 'toggle', singleNote),
    submit: preset(0.21, 0.17, 0.45, 'submit', snapSubmitNotes),
    notification: preset(0.15, 0.4, 0.45, 'notification', snapNotificationNotes),
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
  const delay = note.useDelay === false ? undefined : recipe.delay;

  if (note.useTexture && typeof note.useTexture === 'object') {
    const ov = note.useTexture;
    return {
      waveform: 'noise',
      frequency: 0,
      filterType: ov.filterType,
      filterCutoff: ov.filterCutoff,
      filterQ: ov.filterQ ?? 1,
      volume: noteVolume,
      length: noteLength,
      attack: note.attack,
      detuneCents: note.detuneCents ?? 0,
    };
  }

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
  const waveform = note.waveformOverride ?? recipe.waveform;

  if (waveform === 'noise' || waveform === 'pink-noise') {
    return {
      waveform,
      frequency: 0, // unused for noise sources
      filterType: recipe.filterType,
      filterCutoff: recipe.baseFrequency * pitchMultiplier,
      filterQ,
      volume: noteVolume,
      length: noteLength,
      attack: note.attack,
      delay,
      detuneCents: note.detuneCents ?? 0,
    };
  }

  const frequency = recipe.baseFrequency * pitchMultiplier;

  let sweepTo = note.sweepTo;
  if (sweepTo !== undefined && family === 'soft-bubble') {
    sweepTo = 1 + (sweepTo - 1) * toneT;
  }

  const useFilter = note.useFilter !== false;

  return {
    waveform,
    frequency,
    endFrequency: sweepTo !== undefined ? frequency * sweepTo : undefined,
    filterType: useFilter ? recipe.filterType : undefined,
    filterCutoff: useFilter ? filterCutoff : undefined,
    filterQ: useFilter ? filterQ : undefined,
    volume: noteVolume,
    length: noteLength,
    attack: note.attack,
    delay,
    detuneCents: note.detuneCents ?? 0,
  };
}
