import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// metallic-tact: three evenly-spaced clicks climbing a fourth then a fifth — a mechanical
// ratchet with a real interval, not three near-identical taps. Reconsidered: routing
// these through this family's own narrow bandpass (the source of its "metallic" identity
// everywhere else) read as buzzy/mechanical, not the bright, clean, airy run this instance
// needs — same lesson as notification. waveformOverride:'sine' + useFilter:false carries
// the pitch; a quiet useTexture:true companion at each note (this family's own 4200Hz
// bandpass sheen, same layer the click release uses for its metallic ping) rides
// underneath so the run still reads as metallic-tact, not a generic clean sine.
const successNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.8, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0, lengthFraction: 0.3, pitchMultiplier: 1, volumeMultiplier: 0.22, useTexture: true },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.9, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.28, lengthFraction: 0.32, pitchMultiplier: 1.33, volumeMultiplier: 0.24, useTexture: true },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false },
  { offsetFraction: 0.56, lengthFraction: 0.4, pitchMultiplier: 1.5, volumeMultiplier: 0.26, useTexture: true },
];

// metallic-tact click: strictly two discrete transients — press sits low (mechanical,
// "the key bottoming out"), a real silent gap, then release pings up a real interval
// ("the key returning") — no third layer riding alongside either one. Dropped the
// metallic-sheen texture flick this used to carry on release: even quiet, it's a separate
// noise onset, which reads as a multi-tap flutter rather than one clean ping. No sweep.
// Fast 2ms attack on both notes. Timing tuned so press decays out (38%) well before
// release fires (72%) — at this family's own click length that's a real ~36ms
// onset-to-onset gap, matching paper-snap's exact-match reference. useDelay:false on
// both — a mechanical key strike is dry and punchy, not a resonance that rings on.
// volumeMultiplier scaled up (not the preset default) to compensate this family's Q12
// bandpass, whose passband sits well above the fundamental — almost only a harmonic's
// worth of energy survives, reading noticeably quieter than other families at equal volume.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 0.96, volumeMultiplier: 1.42, attack: 0.002, useDelay: false },
  { offsetFraction: 0.72, lengthFraction: 0.28, pitchMultiplier: 1.28, volumeMultiplier: 0.78, attack: 0.002, useDelay: false },
];

// sent: same loading-recipe structure, at metallic-tact's own register — the square
// wave's odd-harmonic content still carries through its narrow bandpass same as every
// other instance in this family.
const sentNotes: Note[] = [
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
const notificationNotes: Note[] = [
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
const errorNotes: Note[] = [
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

// Mechanical toggle click — two closely-spaced micro-transients (down-stroke + a quiet
// settle). First note decays out before the second fires (a real gap instead of legato
// overlap). useDelay:false on both — zero reverb, immediate feedback. Kept filtered (this
// family's own resonant Q12 bandpass rings up fast enough even at this length to stay
// crisp). volumeMultiplier scaled up (not the preset default) to compensate the Q12
// bandpass, whose passband sits well above this family's own fundamental — almost only a
// harmonic's worth of energy survives, reading noticeably quieter than other families at
// equal volume.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 1.42, attack: 0.002, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 0.94, volumeMultiplier: 0.57, attack: 0.002, useDelay: false },
];

// listening: reconsidered the glide itself — a continuous raw-square sweep is a classic
// "power-up" game convention regardless of volume or attack (that reading comes from the
// waveform and the continuous rise, not the level), so softening it further wasn't going
// to fix the "playful" impression; it needed a different technique, not a quieter one.
// Replaced the sweep with a two-note stepped ratchet instead (root, then a real octave
// up), matching this family's own success identity above — "a mechanical ratchet with a
// real interval, not three near-identical taps" — rather than continuing to reach for
// notification's clean-sine-override trick or sent's swell. Both steps are sine
// (waveformOverride) and unfiltered (useFilter:false), same reasoning as the landing note
// below: this family's own resonant Q12 bandpass sits well above this register and would
// choke them, and raw square would reintroduce the same playful game-sweep character this
// rework exists to remove. Keeps the same overall timing as snap's exact Cuelume "ready"
// match (see families/snap.ts) — the two steps fill the same 12-132ms window the sweep
// used to, then a landing tone from 130ms with a longer decay, 360ms total. The leading
// tick was also reconsidered: a short, hard-attacked (1ms) bandpass noise hit ahead of
// the gesture read as a separate, dominant noise event rather than supporting it.
// Replaced with a soft lowpass breath layer instead (this family's own sent already
// does exactly this — same technique as sentNotes above: a slow 30ms attack, starting
// at the same instant as the steps it sits under, not before them, so it swells in as
// texture rather than announcing itself first. Root step pinned to pitchMultiplier 0.8
// (627Hz, down from this family's own 784Hz base) as the "on" state's default starting
// pitch; the octave step and the landing tone scale off that same 0.8 so the 1:2:3
// harmonic series (shared with every other family's listening — see families/snap.ts)
// stays intact at the new register (627 -> 1254 -> 1882Hz).
const listeningNotes: Note[] = [
  {
    offsetFraction: 0.0333,
    lengthFraction: 0.28,
    pitchMultiplier: 1,
    volumeMultiplier: 0.3,
    useTexture: { filterType: 'lowpass', filterCutoff: 1800, filterQ: 1 },
    useDelay: false,
    attack: 0.03,
  },
  {
    offsetFraction: 0.0333,
    lengthFraction: 0.15,
    pitchMultiplier: 0.8,
    volumeMultiplier: 0.5,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.015,
  },
  {
    offsetFraction: 0.1833,
    lengthFraction: 0.1833,
    pitchMultiplier: 1.6,
    volumeMultiplier: 0.65,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.015,
  },
  {
    offsetFraction: 0.3611,
    lengthFraction: 0.6389,
    pitchMultiplier: 2.4,
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
    useTexture: { filterType: 'lowpass', filterCutoff: 1800, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'square',
  baseFrequency: 784, // G5
  filterType: 'bandpass',
  filterCutoffRange: [1400, 3200],
  filterQ: 12,
  // Short comb-like metallic ring — a real physical resonance, not just a click.
  delay: { time: 0.002, feedback: 0.28, wet: 0.4, lowpass: 3800 },
  textureLayer: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 4, volumeMultiplier: 0.42, lengthFraction: 0.22 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.18, 0.012, 0.45, 'hover', hoverNote),
  click: preset(0.24, 0.05, 0.45, 'click', clickNotes),
  // 220ms, up from 140ms — matches the broader success pack.
  success: preset(0.3, 0.22, 0.5, 'success', successNotes),
  error: preset(0.22, 0.17, 0.3, 'error', errorNotes),
  toggle: preset(0.24, 0.018, 0.45, 'toggle', toggleNotes),
  sent: preset(0.22, 0.18, 0.45, 'sent', sentNotes),
  notification: preset(0.15, 0.4, 0.3, 'notification', notificationNotes),
  listening: preset(0.22, 0.36, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const metallicTact: SoundFamilyModule = { name: 'metallic-tact', recipe, presets };
export default metallicTact;
