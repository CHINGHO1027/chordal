import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// --- glass-crystal: bespoke per-instance gestures, leaning into the family's resonant
// highpass — real intervals given room so the resonance can actually ring, rather than
// generic clicks riding on top of the brightness.

// click: strictly two discrete transients — press sits at the tap (weighted), a real
// silent gap, then release jumps to a brighter fourth (crisp) — no third layer riding
// alongside either one. Dropped the texture-flick companion this used to carry on
// release: even quiet, it's a separate noise onset, which reads as a multi-tap flutter
// rather than one clean hit. No pitch sweep — the resonant highpass Q makes a swept pitch
// ring/wobble near its own resonant peak, on top of reading as flutter on a note this
// short anyway. Fast 2ms attack on both notes. Timing tuned so press decays out (ends at
// 38%) well before release fires (72%) — at this family's own click length that's a real
// ~33ms onset-to-onset gap, matching paper-snap's exact-match reference. useDelay:false on
// both — dry and punchy, not a resonance that should ring on past the gesture.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.72, lengthFraction: 0.28, pitchMultiplier: 1.33, volumeMultiplier: 0.5, attack: 0.002, useDelay: false },
];

// congrats: an ascending "ting-ting-TING" — root, fifth, octave — the biggest interval
// jumps of any family's congrats, matching how far a glass resonance actually carries.
const congratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.34, pitchMultiplier: 1, volumeMultiplier: 0.75 },
  { offsetFraction: 0.28, lengthFraction: 0.36, pitchMultiplier: 1.5, volumeMultiplier: 0.9 },
  { offsetFraction: 0.56, lengthFraction: 0.44, pitchMultiplier: 2, volumeMultiplier: 1 },
];

// toggle: two closely-spaced micro-transients, a genuine descending fourth — a mechanical
// latch, not a musical phrase. First note decays out before the second fires (a real gap
// instead of the legato overlap this used to have). useDelay:false on both — zero reverb.
// useFilter:false on both — this family's resonant highpass has its own settling time,
// which on a note this short softened the onset into a gradual swell instead of an instant
// snap; bypassing it gives the raw tone an unfiltered, instant attack.
// Register raised modestly (pitchMultiplier 1.25/0.98, landing ~1300Hz/1020Hz) — this
// family's 1046Hz home was already close to clean, but the descending release note (0.78x
// -> ~816Hz) was dipping low enough for a sine burst this short to lose definition. Lifting
// both keeps the release comfortably above the ~1kHz floor where a burst this brief still
// resolves a clean pitch.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1.25, volumeMultiplier: 1, attack: 0.002, useFilter: false, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 0.98, volumeMultiplier: 0.7, attack: 0.002, useFilter: false, useDelay: false },
];

// submit: same loading-recipe structure as soft-bubble's exact match (slow-attack tone
// glide + soft lowpass breath, no shimmer on the breath), tuned to glass-crystal's own
// register and filter safety instead of copying soft-bubble's numbers. pitchMultiplier
// 0.8 keeps the tone comfortably above this family's highpass cutoff at submit's own tone
// value (0.45 -> ~702Hz cutoff; 0.8x = ~837Hz start, clear margin) — the same safety
// margin every other glass-crystal instance already respects.
const submitNotes: Note[] = [
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
const notificationNotes: Note[] = [
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
const errorNotes: Note[] = [
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

// listening: tick, an octave glide, then a landing tone a further fifth up (1:2:3, same
// harmonic series as this instance's reference across every family — see
// families/snap.ts). Register dialed down from the family's own 1046Hz base (P=0.6
// rather than 1) so the landing tone (3x) doesn't push into an extreme high register.
// Glide filtered (this family's own highpass still passes it cleanly); landing unfiltered
// so the "locked on" resolve reads clean. First pass — not yet validated by ear.
const listeningNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.12, pitchMultiplier: 0.6, volumeMultiplier: 0.5, useTexture: true, attack: 0.001 },
  { offsetFraction: 0.06, lengthFraction: 0.55, pitchMultiplier: 0.6, sweepTo: 1.2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.55, lengthFraction: 0.45, pitchMultiplier: 1.8, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
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
    useTexture: { filterType: 'lowpass', filterCutoff: 2200, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'sine',
  baseFrequency: 1046, // C6
  filterType: 'highpass',
  // Raised from 950 — that cutoff sat below every note this family actually plays
  // (hover ~1130Hz, click's press ~1004Hz, congrats's first note ~1098Hz), so a pure
  // sine had zero energy there for even a high-Q peak to catch: the "singing resonant
  // peak" qRange below describes was never actually audible, at any tone value. Nudged
  // up just enough to bring the peak within reach of that cluster — click's press note
  // in particular now sits right at the edge at high tone, for a genuine ring — while
  // staying under submit's own margin-tuned pitch (~837Hz) at its default tone so it
  // isn't newly silenced.
  filterCutoffRange: [500, 1000],
  // Pushed more resonant than tiny-sparkle's (which went the opposite way, toward
  // broadband) — this is the family's actual distinguishing character now: a narrow,
  // singing resonant peak, not just "highpass + shimmer" shared with tiny-sparkle.
  // Top raised from 11 now that the cutoff actually reaches real signal — a sharper
  // peak rings more distinctly on the notes that pass near it instead of coloring silence.
  qRange: [2.5, 15],
  // Slower, longer shimmer than tiny-sparkle — one spacious ring, not a flurry of
  // glints. Tail lands near chime's (~0.78s vs ~0.72s) rather than exceeding every other
  // family's, which would risk the same always-heavy problem chime's gain staging fixed.
  delay: { time: 0.13, feedback: 0.24, wet: 0.22, lowpass: 4200 },
  pitchRange: [0.7, 1.8],
  textureLayer: { filterType: 'bandpass', filterCutoff: 5400, filterQ: 3, volumeMultiplier: 0.42, lengthFraction: 0.22 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.18, 0.009, 0.55, 'hover', hoverNote),
  click: preset(0.24, 0.046, 0.5, 'click', clickNotes),
  congrats: preset(0.3, 0.22, 0.65, 'congrats', congratsNotes),
  error: preset(0.22, 0.195, 0.3, 'error', errorNotes),
  toggle: preset(0.23, 0.022, 0.5, 'toggle', toggleNotes),
  submit: preset(0.22, 0.18, 0.45, 'submit', submitNotes),
  notification: preset(0.2, 0.4, 0.3, 'notification', notificationNotes),
  listening: preset(0.22, 0.32, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const glassCrystal: SoundFamilyModule = { name: 'glass-crystal', recipe, presets };
export default glassCrystal;
