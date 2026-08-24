import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// digital-blip: reconsidered — this family's own bandpass coloring plus a 2-note jump
// (with a wobbly landing sweep) read as a "blip," not the bright, clean, airy ascending
// run this instance needs. waveformOverride:'sine' + useFilter:false, expanded to a
// genuine 3-note consonant climb (root, major third, fifth) for real ascending motion, no
// sweep (clean landing instead of a wobble). Register raised (pitchMultiplier ~2.2, vs
// this family's usual ~1x) — its native 360Hz base reads as warm/low, not bright, once
// it's a clean sine rather than a filtered square. A quiet useTexture:true companion rides
// under each tone — the same "grit" layer hover/click already use — so the run keeps this
// family's digital edge instead of sounding like a generic clean sine climb.
const congratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 2.2, volumeMultiplier: 0.8, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 2.2, volumeMultiplier: 0.28, useTexture: true },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 2.772, volumeMultiplier: 0.9, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 2.772, volumeMultiplier: 0.3, useTexture: true },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 3.3, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 3.3, volumeMultiplier: 0.32, useTexture: true },
];

// hover/click keep a quick, quiet click layered under the square tone for a little grit.
const hoverNotes: Note[] = [
  ...hoverNote,
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.35, useTexture: true },
];

// Strictly two discrete transients: press low, solid, weighted; a real silent gap; then
// release high, brief, crisp — no third layer riding alongside either one (echoing how
// Cuelume's own press/release are two separately-triggered recipes, not one sound plus
// decoration). Real minor-third interval between them (not a ~1-semitone token nudge). No
// pitch sweep on either note — Cuelume's own press/release don't sweep at all (static
// frequency + filter brightness + decay length do all the work); forcing a glide into a
// note this short read as an unstable flutter. Fast 2ms attack on both notes for a genuine
// transient. Timing tuned so press decays out (40%) well before release fires (71%) — at
// this family's own click length that's a real ~31ms onset-to-onset gap, matching
// paper-snap's exact-match reference. useDelay:false on both — dry and punchy, not a
// resonance that should ring on past the gesture. volumeMultiplier scaled up (not the
// preset default) to compensate this family's Q5 bandpass, which passes only a slice of
// this square wave's energy — the same nominal `volume` as other families' click was
// reading noticeably quieter here.
//
// Even a quiet texture accent on release is still a separate noise onset — three audible
// transients instead of two clean ones. Dropped entirely; click is just these two tone
// notes, same as every other family this pass.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.4, pitchMultiplier: 0.96, volumeMultiplier: 1.3, attack: 0.002, useDelay: false },
  { offsetFraction: 0.71, lengthFraction: 0.28, pitchMultiplier: 1.26, volumeMultiplier: 0.72, attack: 0.002, useDelay: false },
];

// toggle: own note set rather than reusing the generic click-transient shape — this
// family's 360Hz register is the lowest of any family using this pattern, and its own Q5
// bandpass needs a few cycles to ring up to its resonant peak; on a note this short the
// filter's own settling time was eating a large fraction of the note and reading as a
// muffled thump instead of a crisp blip. useFilter:false bypasses that settling time for
// an instant raw-square attack. useDelay:false — zero reverb.
// Register raised well above this family's usual 360Hz home (pitchMultiplier 3.0/2.82,
// landing ~1080Hz/1015Hz) — 360Hz was the lowest fundamental of any family attempting this
// pattern; even filter-bypassed, a burst this short only fit ~2-3 cycles at 360Hz, nowhere
// near enough to resolve a clean pitch. At ~1kHz the same duration holds 8-9 cycles.
// volumeMultiplier scaled down (not the preset default) — going unfiltered above removed
// the bandpass attenuation this family's other instances still have, so at the old
// multiplier this was playing at full unfiltered energy and reading louder than its
// filtered siblings.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 3.0, volumeMultiplier: 0.73, attack: 0.002, useFilter: false, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 2.82, volumeMultiplier: 0.29, attack: 0.002, useFilter: false, useDelay: false },
];

// submit: same loading-recipe structure, at digital-blip's own low 360Hz register — the
// breath's cutoff is pulled down to match rather than reusing a register tuned for a
// family sitting an octave-plus higher.
const submitNotes: Note[] = [
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
const notificationNotes: Note[] = [
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
const errorNotes: Note[] = [
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

// listening: tick, an octave glide, then a landing tone a further fifth up (1:2:3, same
// harmonic series as this instance's reference across every family — see
// families/snap.ts). Glide keeps this family's own square waveform (native, filtered);
// landing gets waveformOverride:'sine' (raw square judged too harsh for a clean resolve,
// same technique this family's own notification already uses) plus useFilter:false so the
// "locked on" tone reads clean. First pass — not yet validated by ear.
const listeningNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.12, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, attack: 0.001 },
  { offsetFraction: 0.06, lengthFraction: 0.55, pitchMultiplier: 1, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  {
    offsetFraction: 0.55,
    lengthFraction: 0.45,
    pitchMultiplier: 3,
    volumeMultiplier: 1,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.004,
  },
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
    useTexture: { filterType: 'lowpass', filterCutoff: 1600, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'square',
  baseFrequency: 360,
  filterType: 'bandpass',
  filterCutoffRange: [360, 880],
  filterQ: 5,
  delay: { time: 0.02, feedback: 0.18, wet: 0.16, lowpass: 4200 },
  textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 5, volumeMultiplier: 0.32, lengthFraction: 0.25 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.17, 0.009, 0.4, 'hover', hoverNotes),
  click: preset(0.23, 0.044, 0.4, 'click', clickNotes),
  // 220ms, up from 120ms — matches the broader congrats pack now that this is a real
  // 3-note ascending run instead of a 2-note jump.
  congrats: preset(0.3, 0.22, 0.45, 'congrats', congratsNotes),
  error: preset(0.22, 0.16, 0.25, 'error', errorNotes),
  toggle: preset(0.22, 0.026, 0.4, 'toggle', toggleNotes),
  submit: preset(0.2, 0.16, 0.4, 'submit', submitNotes),
  notification: preset(0.15, 0.4, 0.4, 'notification', notificationNotes),
  listening: preset(0.22, 0.32, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const digitalBlip: SoundFamilyModule = { name: 'digital-blip', recipe, presets };
export default digitalBlip;
