import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// --- spring: bespoke per-instance gestures built around a real physical overshoot —
// compress, then rebound past rest before settling — using sweepTo for the rebound rather
// than a flat second pitch.

// click: strictly two discrete transients — compress down, a real silent gap, then
// rebound overshoots upward — no third layer riding alongside either one. Static pitch on
// both (press below rest at 0.9x, release above it at 1.15x — the "overshoot" comes from
// the interval, not a glide, since a sweep on a note this short reads as an unstable
// warble). Dropped the texture-flick companion this used to carry on release: even quiet,
// it's a separate noise onset, which reads as a multi-tap flutter rather than one clean
// rebound. Fast 2ms attack on both notes. Timing tuned so press decays out (39%) well
// before release fires (71%) — at this family's own click length that's a real ~35ms
// onset-to-onset gap, matching paper-snap's exact-match reference. useDelay:false on
// both — a physical contact sound is dry and punchy, not a resonance that rings on.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.39, pitchMultiplier: 0.9, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.71, lengthFraction: 0.29, pitchMultiplier: 1.15, volumeMultiplier: 0.55, attack: 0.002, useDelay: false },
];

// sent: the loading-recipe structure (slow-attack tone + soft breath), but with a small
// overshoot past the fifth before it would settle — spring's own physical signature kept
// on top of the shared structure rather than a plain, unadorned glide.
const sentNotes: Note[] = [
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
const notificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1.0154, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1.0154, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// success: a bouncy ascending run (root, fourth, fifth) where the final note overshoots
// upward before relaxing — the spring settling past its target, not a clean landing.
// useFilter:false on all three: the family's lowpass cutoff is computed once from `tone`
// and held fixed across the whole gesture, so as these notes climb toward and past it
// (691Hz/780Hz against a ~722Hz cutoff at this preset's tone) it was quietly muffling
// exactly the notes that needed to sound brighter, undercutting the ascent instead of
// letting it read.
const successNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.32, pitchMultiplier: 1, volumeMultiplier: 0.8, useFilter: false },
  { offsetFraction: 0.26, lengthFraction: 0.34, pitchMultiplier: 1.33, volumeMultiplier: 0.85, useFilter: false },
  { offsetFraction: 0.52, lengthFraction: 0.48, pitchMultiplier: 1.5, volumeMultiplier: 1, sweepTo: 1.08, useFilter: false },
];

// Same knock+2-tone pattern as snap's exact Cuelume match, at spring's own 520Hz register.
// Dropped the "boing-down" sweep this used to carry on both tones — the only family's error
// tones still doing this (every other family settled on static pitch here). A pitch sweep
// makes each cycle within a live analyser window a slightly different width as the
// frequency ramps, which reads as the waveform bunching up lopsided to one side rather than
// centered — the actual bug report. Static pitch, matching every other family's error.
const errorNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.16,
    pitchMultiplier: 1,
    volumeMultiplier: 1,
    useTexture: { filterType: 'bandpass', filterCutoff: 900, filterQ: 1.1 },
    useDelay: false,
    attack: 0.001,
  },
  { offsetFraction: 0.1, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.35, useFilter: false, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.58, pitchMultiplier: 0.7937, volumeMultiplier: 0.31, useFilter: false, useDelay: false, attack: 0.004 },
];

// toggle: two closely-spaced micro-transients, a mechanical latch rather than a musical
// phrase. Dropped the sweep (a glide reads as soft/mushy, not a discrete snap into place)
// and the legato overlap — first note decays out before the second fires.
// useDelay:false on both — zero reverb. useFilter:false on both — this family's lowpass
// has its own settling time, which on a note this short softened the onset into a gradual
// swell instead of an instant snap; bypassing it gives the raw tone an instant attack.
// Register raised well above this family's usual 520Hz home (pitchMultiplier 2.0/2.38,
// landing ~1040Hz/1238Hz) — same psychoacoustic floor as soft-bubble and digital-blip: a
// burst this short only fit ~3-4 cycles at 520Hz, too few to resolve a clean pitch.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 2.0, volumeMultiplier: 1, attack: 0.002, useFilter: false, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 2.38, volumeMultiplier: 0.55, attack: 0.002, useFilter: false, useDelay: false },
];

// listening: same timing skeleton as snap's exact Cuelume "ready" match (see
// families/snap.ts) — a tick at Q1.8 (their own tick's Q, tighter than this family's
// usual texture-layer Q) at 0-29ms, a real octave glide from 12ms lasting 120ms, then a
// landing tone from 130ms with a longer decay, 360ms total. Register and texture stay
// this family's own: the tick reuses this family's own textureLayer cutoff (2900Hz, not
// their literal 3600) and the glide/landing keep this family's own P=1 register rather
// than their literal 330/660/990Hz — own identity, their pattern. Glide filtered (this
// family's own lowpass colors it as it climbs); landing (1560Hz) already sits above this
// family's own filterCutoffRange top (940Hz), so useFilter:false there reads clean
// without needing any extra override.
const listeningNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.08,
    pitchMultiplier: 1,
    volumeMultiplier: 0.5,
    useTexture: { filterType: 'bandpass', filterCutoff: 2900, filterQ: 1.8 },
    attack: 0.001,
  },
  { offsetFraction: 0.0333, lengthFraction: 0.3333, pitchMultiplier: 1, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.3611, lengthFraction: 0.6389, pitchMultiplier: 3, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
];

// delete: a soft lowpass flick, then this family's own textureLayer as the brighter
// crackle, then a tiny unfiltered tick — dry (useDelay:false), reading as discarded
// rather than lingering. See families/paper-snap.ts for this instance's reference family.
const deleteNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.35,
    pitchMultiplier: 1,
    volumeMultiplier: 0.8,
    useTexture: { filterType: 'lowpass', filterCutoff: 1300, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'sine',
  baseFrequency: 520,
  filterType: 'lowpass',
  filterCutoffRange: [520, 940],
  qRange: [1, 5], // resonance bump scales with tone
  delay: { time: 0.07, feedback: 0.25, wet: 0.18, lowpass: 3200 },
  textureLayer: { filterType: 'bandpass', filterCutoff: 2900, filterQ: 2.5, volumeMultiplier: 0.42, lengthFraction: 0.24 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.18, 0.011, 0.45, 'hover', hoverNote),
  click: preset(0.24, 0.049, 0.42, 'click', clickNotes),
  success: preset(0.3, 0.22, 0.48, 'success', successNotes),
  error: preset(0.22, 0.14, 0.28, 'error', errorNotes),
  toggle: preset(0.23, 0.023, 0.42, 'toggle', toggleNotes),
  sent: preset(0.22, 0.2, 0.45, 'sent', sentNotes),
  // exact reference match to Cuelume's bloom — see notificationNotes.
  notification: preset(0.12, 0.4, 0.45, 'notification', notificationNotes),
  listening: preset(0.22, 0.36, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const spring: SoundFamilyModule = { name: 'spring', recipe, presets };
export default spring;
