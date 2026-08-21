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

export type SoundInstance = 'hover' | 'click' | 'congrats' | 'error' | 'toggle';

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

export const SOUND_INSTANCES: SoundInstance[] = ['hover', 'click', 'congrats', 'error', 'toggle'];

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
  /**
   * Set false to skip the family's shimmer/delay on this note specifically. Defaults to
   * true. The delay's feedback tail runs for a fixed duration independent of note length
   * (see engine.shimmerTailSeconds) — for an instant, weightless cue like hover, that tail
   * lingers long after the note itself has ended, which reads as heavy rather than light.
   */
  useDelay?: boolean;
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

// press: low, solid, weighted. release: high, brief, crisp. Real minor-third interval
// between them (not a ~1-semitone token nudge), release deliberately shorter than press
// (brief, not lingering) rather than the reverse. No pitch sweep on either note — Cuelume's
// own press/release don't sweep at all (static frequency + filter brightness + decay
// length do all the work); forcing a glide into a note this short read as an unstable
// flutter rather than a clean transition.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.64, pitchMultiplier: 0.96, volumeMultiplier: 1 },
  { offsetFraction: 0.56, lengthFraction: 0.3, pitchMultiplier: 1.26, volumeMultiplier: 0.5 },
];

// A muted, barely-descending click — a "blocked" signal, not a dramatic downward scoop.
const errorNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.88 }];

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

// click: a soft squeeze-down + a quieter spring-back lift — the sweep gives it real
// physical "give" rather than a static click. Release also gets a quiet bright-noise
// flick layered under its tonal sweep — the actual source of "crisp," per Cuelume's own
// release recipe, which a sine sweep alone can't produce.
const softBubbleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.62, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.88 },
  { offsetFraction: 0.54, lengthFraction: 0.32, pitchMultiplier: 1.19, volumeMultiplier: 0.45, sweepTo: 1.12 },
  { offsetFraction: 0.54, lengthFraction: 0.32, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
];

// congrats: three bubbles blooping upward — root, major third, fifth — each with its own
// gentle upward sweep, spaced with real room to ring rather than a flat 3-note run.
const softBubbleCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.36, pitchMultiplier: 1, volumeMultiplier: 0.8, sweepTo: 1.05 },
  { offsetFraction: 0.3, lengthFraction: 0.38, pitchMultiplier: 1.26, volumeMultiplier: 0.9, sweepTo: 1.05 },
  { offsetFraction: 0.6, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.05 },
];

// error: a knock plus a genuine descending minor-third second note, still soft/muted.
const softBubbleErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.55, pitchMultiplier: 1, volumeMultiplier: 0.9, sweepTo: 0.85 },
  { offsetFraction: 0.45, lengthFraction: 0.55, pitchMultiplier: 0.79, volumeMultiplier: 0.6 },
];

// toggle: two soft bubbles, a real minor-third step between them.
const softBubbleToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.95 },
  { offsetFraction: 0.46, lengthFraction: 0.54, pitchMultiplier: 1.12, volumeMultiplier: 0.6 },
];

// --- glass-crystal: bespoke per-instance gestures, leaning into the family's resonant
// highpass — real intervals given room so the resonance can actually ring, rather than
// generic clicks riding on top of the brightness.

// click: press sits at the tap (weighted), release jumps to a brighter fourth (crisp) —
// and stays the shorter of the two, so the lift reads as brief, not lingering. No pitch
// sweep — on a note this short a glide read as flutter, not a clean interval jump; the
// resonant highpass Q made it worse (a swept pitch passing near the filter's own resonant
// peak rings/wobbles). The static fourth plus the texture flick below carry "crisp" now.
const glassCrystalClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.56, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.48, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.45 },
  { offsetFraction: 0.48, lengthFraction: 0.32, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
];

// congrats: an ascending "ting-ting-TING" — root, fifth, octave — the biggest interval
// jumps of any family's congrats, matching how far a glass resonance actually carries.
const glassCrystalCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.34, pitchMultiplier: 1, volumeMultiplier: 0.75 },
  { offsetFraction: 0.28, lengthFraction: 0.36, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.56, lengthFraction: 0.44, pitchMultiplier: 2, volumeMultiplier: 1 },
];

// error: a sharp crack plus a muted descending second note.
const glassCrystalErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.45, pitchMultiplier: 1, volumeMultiplier: 0.9, sweepTo: 0.9 },
  { offsetFraction: 0.4, lengthFraction: 0.6, pitchMultiplier: 0.75, volumeMultiplier: 0.65 },
];

// toggle: a real two-part crystalline click-clack, a genuine descending fourth.
const glassCrystalToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.45, lengthFraction: 0.55, pitchMultiplier: 0.78, volumeMultiplier: 0.7 },
];

// --- chime: bespoke per-instance gestures, not the shared templates. Cuelume's own
// chime is two clean unfiltered sine layers a fifth apart, spaced 90ms with 220-260ms
// of individual decay each — the "bell" comes from real interval + room to ring, not
// from more notes packed tighter. Applied here at chime's own register or without
// literally copying their numbers.

// click: press sits at the tap (weighted), release jumps a minor third up (crisp) and
// stays the shorter of the two — echoing how Cuelume's press/release are two separate
// recipes rather than one sound scaled down. No sweep: Cuelume's own release doesn't glide
// either, and a forced glide on a ~10ms note read as flutter, not a clean interval jump.
const chimeClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.58, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.5, lengthFraction: 0.34, pitchMultiplier: 1.19, volumeMultiplier: 0.5 },
  { offsetFraction: 0.5, lengthFraction: 0.34, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
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

// error: a knock plus a genuine descending second note — a two-part "no," still muted
// rather than harsh, instead of one lone pitch sweep.
const chimeErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.9, sweepTo: 0.94 },
  { offsetFraction: 0.4, lengthFraction: 0.6, pitchMultiplier: 0.84, volumeMultiplier: 0.8 },
];

// toggle: a real two-part click-clack — a genuine step between the two notes, not a
// barely-there wobble.
const chimeToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.45, lengthFraction: 0.55, pitchMultiplier: 0.82, volumeMultiplier: 0.75 },
];

// paper-snap: a real jump (not a semitone nudge) — the bandpass center shifts a fifth
// up on the second tap, audible even without a true pitched fundamental.
const paperSnapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.45, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.4, lengthFraction: 0.5, pitchMultiplier: 1.5, volumeMultiplier: 1 },
];

// paper-snap click: noise-native, so this is the one family that can mirror Cuelume's
// actual press/release technique directly — theirs is entirely built from bandpass-noise
// filter brightness (a dull ~1700Hz knock vs a bright ~4600Hz flick), not a pitch sweep at
// all. pitchMultiplier here scales the bandpass center, not a fundamental, so a wide swing
// (0.65 -> 1.8, vs the ~1x -> ~1.2x every pitched family uses) reproduces that same
// dull-knock / bright-flick contrast on our own register.
const paperSnapClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6, pitchMultiplier: 0.65, volumeMultiplier: 1 },
  { offsetFraction: 0.5, lengthFraction: 0.28, pitchMultiplier: 1.8, volumeMultiplier: 0.55 },
];

// metallic-tact: three evenly-spaced clicks climbing a fourth then a fifth — a mechanical
// ratchet with a real interval, not three near-identical taps.
const metallicTactCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.9 },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 1 },
];

// metallic-tact click: press sits low (mechanical), release pings up a real interval
// with a bright metallic-sheen texture flick for the crispness. No sweep — a glide
// squeezed into a ~7ms note read as flutter rather than a clean ping.
const metallicTactClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.62, pitchMultiplier: 0.96, volumeMultiplier: 1 },
  { offsetFraction: 0.54, lengthFraction: 0.3, pitchMultiplier: 1.28, volumeMultiplier: 0.5 },
  { offsetFraction: 0.54, lengthFraction: 0.22, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
];

// digital-blip: a real upward leap (fifth) with a sweep on the landing note — reads as
// "confirmed," not a barely-there wobble.
const digitalBlipCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.34, lengthFraction: 0.55, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.12 },
];
// hover/click keep a quick, quiet click layered under the square tone for a little grit.
const digitalBlipHoverNotes: Note[] = [
  ...hoverNote,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.35, useTexture: true },
];
const digitalBlipClickNotes: Note[] = [
  ...clickNotes,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.32, useTexture: true },
  // extra flick right on the release, on top of the grit note above — reinforces the
  // upward snap's crispness specifically, rather than texture spread evenly across both.
  { offsetFraction: 0.56, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.35, useTexture: true },
];

// --- spring: bespoke per-instance gestures built around a real physical overshoot —
// compress, then rebound past rest before settling — using sweepTo for the rebound rather
// than a flat second pitch.

// click: compress down, then rebound overshoots upward before it would settle — a genuine
// spring release, not a static two-note click.
const springClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.44, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.82 },
  { offsetFraction: 0.38, lengthFraction: 0.4, pitchMultiplier: 0.94, volumeMultiplier: 0.55, sweepTo: 1.28 },
  { offsetFraction: 0.38, lengthFraction: 0.25, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
];

// congrats: a bouncy ascending run (root, fourth, fifth) where the final note overshoots
// upward before relaxing — the spring settling past its target, not a clean landing.
const springCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.32, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.26, lengthFraction: 0.34, pitchMultiplier: 1.33, volumeMultiplier: 0.85 },
  { offsetFraction: 0.52, lengthFraction: 0.48, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.08 },
];

// error: a compressed "boing-down" — dips low, wobbles slightly on the way to rest.
const springErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.9, sweepTo: 0.8 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.86, volumeMultiplier: 0.6, sweepTo: 0.94 },
];

// toggle: click + a small springy rebound step.
const springToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.48, pitchMultiplier: 1, volumeMultiplier: 1, sweepTo: 0.9 },
  { offsetFraction: 0.44, lengthFraction: 0.56, pitchMultiplier: 1.19, volumeMultiplier: 0.55 },
];

// --- tiny-sparkle: bespoke per-instance gestures — quick, bright, and light, distinct
// from every other family's timing by being genuinely fast rather than just quiet.

// click: a very light two-part twinkle — press sits at the root, release leaps a real
// fifth up and stays the shorter of the two notes. No sweep: at ~6ms this note is the
// shortest of any family's release, nowhere near long enough for a glide to read as
// anything but flutter — the fifth interval alone already carries plenty of "up."
const tinySparkleClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.46, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.4, lengthFraction: 0.3, pitchMultiplier: 1.5, volumeMultiplier: 0.5 },
  { offsetFraction: 0.4, lengthFraction: 0.22, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
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

// error: a quick, quiet descending dim rather than a harsh cutoff.
const tinySparkleErrorNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.5, pitchMultiplier: 1, volumeMultiplier: 0.85, sweepTo: 0.9 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.75, volumeMultiplier: 0.55 },
];

// toggle: quick light click-clack, a real descending major third.
const tinySparkleToggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.46, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.79, volumeMultiplier: 0.6 },
];

// snap: a real fourth-ish jump on the second hit — still snappy, but with somewhere to land.
const snapCongratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.36, lengthFraction: 0.5, pitchMultiplier: 1.33, volumeMultiplier: 1 },
];

// snap click: press sits low (weighted), release snaps up a real fourth with a bright
// texture flick for the crispness. No sweep — at ~4.5ms this is close to tiny-sparkle's
// release for shortness; a glide had no room to read as anything but flutter.
const snapClickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6, pitchMultiplier: 0.96, volumeMultiplier: 1 },
  { offsetFraction: 0.52, lengthFraction: 0.28, pitchMultiplier: 1.3, volumeMultiplier: 0.5 },
  { offsetFraction: 0.52, lengthFraction: 0.2, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true },
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
    click: preset(0.24, 0.028, 0.42, 'click', softBubbleClickNotes),
    // 220ms, up from 160ms — 3 real-interval notes need more room than the old flat
    // arpeggio timing gave them.
    congrats: preset(0.3, 0.22, 0.5, 'congrats', softBubbleCongratsNotes),
    error: preset(0.22, 0.055, 0.25, 'error', softBubbleErrorNotes),
    toggle: preset(0.22, 0.026, 0.42, 'toggle', softBubbleToggleNotes),
  },
  'glass-crystal': {
    hover: preset(0.18, 0.009, 0.55, 'hover', hoverNote),
    click: preset(0.24, 0.024, 0.5, 'click', glassCrystalClickNotes),
    congrats: preset(0.3, 0.22, 0.65, 'congrats', glassCrystalCongratsNotes),
    error: preset(0.22, 0.05, 0.3, 'error', glassCrystalErrorNotes),
    toggle: preset(0.23, 0.024, 0.5, 'toggle', glassCrystalToggleNotes),
  },
  'paper-snap': {
    hover: preset(0.17, 0.008, 0.5, 'hover', hoverNote),
    click: preset(0.23, 0.015, 0.5, 'click', paperSnapClickNotes),
    congrats: preset(0.3, 0.11, 0.55, 'congrats', paperSnapCongratsNotes),
    error: preset(0.22, 0.035, 0.3, 'error', errorNotes),
    toggle: preset(0.22, 0.014, 0.5, 'toggle', singleNote),
  },
  'metallic-tact': {
    hover: preset(0.18, 0.012, 0.45, 'hover', hoverNote),
    click: preset(0.24, 0.022, 0.45, 'click', metallicTactClickNotes),
    congrats: preset(0.3, 0.14, 0.5, 'congrats', metallicTactCongratsNotes),
    error: preset(0.22, 0.05, 0.3, 'error', errorNotes),
    toggle: preset(0.24, 0.02, 0.45, 'toggle', toggleClickNotes),
  },
  chime: {
    // Volumes pulled well below the shared limiter's -8dB (~0.4) threshold — Cuelume's
    // chime notes land around 0.16-0.18 after their own gain staging, comfortably under
    // their limiter too, so a single note never gets compressed. Ours were sitting at or
    // above threshold, so the limiter was squashing almost every chime hit — that
    // gain-reduction pumping is what read as "heavy" next to their untouched transients.
    hover: preset(0.18, 0.012, 0.5, 'hover', hoverNote),
    click: preset(0.23, 0.03, 0.5, 'click', chimeClickNotes),
    // 0.18 volume + 356ms length: solved to land at the exact same final amplitude
    // (~0.18/0.16 post-limiter-headroom) and total decay time as Cuelume's own two chime
    // layers (226ms + 266ms decay, second note entering at the 90ms mark) — see
    // chimeCongratsNotes above for the rest of the mapping.
    congrats: preset(0.18, 0.356, 0.55, 'congrats', chimeCongratsNotes),
    error: preset(0.21, 0.09, 0.28, 'error', chimeErrorNotes),
    toggle: preset(0.23, 0.028, 0.5, 'toggle', chimeToggleNotes),
  },
  'digital-blip': {
    hover: preset(0.17, 0.009, 0.4, 'hover', digitalBlipHoverNotes),
    click: preset(0.23, 0.016, 0.4, 'click', digitalBlipClickNotes),
    congrats: preset(0.3, 0.12, 0.45, 'congrats', digitalBlipCongratsNotes),
    error: preset(0.22, 0.038, 0.25, 'error', errorNotes),
    toggle: preset(0.22, 0.014, 0.4, 'toggle', toggleClickNotes),
  },
  spring: {
    hover: preset(0.18, 0.011, 0.45, 'hover', hoverNote),
    click: preset(0.24, 0.03, 0.42, 'click', springClickNotes),
    congrats: preset(0.3, 0.22, 0.48, 'congrats', springCongratsNotes),
    error: preset(0.22, 0.055, 0.28, 'error', springErrorNotes),
    toggle: preset(0.23, 0.027, 0.42, 'toggle', springToggleNotes),
  },
  'tiny-sparkle': {
    hover: preset(0.15, 0.008, 0.2, 'hover', hoverNote),
    click: preset(0.22, 0.02, 0.2, 'click', tinySparkleClickNotes),
    // 280ms — matches Cuelume's own sparkle's real total span (last note starts at 135ms,
    // decays 120ms, ≈255ms) now that the notes carry their real individual decay times
    // instead of a compressed fixed fraction. Volume kept in family (still the loudest of
    // tiny-sparkle's own 5 instances, same as every other family's congrats) rather than
    // matching Cuelume's sparkle-is-half-as-loud-as-their-chime ratio — that ratio compares
    // two different Cuelume recipes, not analogous to congrats vs. its own family's hover.
    congrats: preset(0.28, 0.28, 0.32, 'congrats', tinySparkleCongratsNotes),
    error: preset(0.2, 0.042, 0.12, 'error', tinySparkleErrorNotes),
    toggle: preset(0.2, 0.022, 0.2, 'toggle', tinySparkleToggleNotes),
  },
  snap: {
    hover: preset(0.18, 0.009, 0.5, 'hover', hoverNote),
    click: preset(0.24, 0.016, 0.5, 'click', snapClickNotes),
    congrats: preset(0.3, 0.1, 0.55, 'congrats', snapCongratsNotes),
    error: preset(0.22, 0.035, 0.32, 'error', errorNotes),
    toggle: preset(0.23, 0.014, 0.5, 'toggle', singleNote),
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
      delay,
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
    delay,
    detuneCents: note.detuneCents ?? 0,
  };
}
