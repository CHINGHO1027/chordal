import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// --- soft-bubble: bespoke per-instance gestures. Leans on the family's existing
// "gimmick" from resolve.ts's resolveNoteParams — a sweepTo glide whose magnitude scales
// with `tone` (see FamilyRecipe.toneScalesSweep) — for a genuine squeeze/bloop quality
// instead of a flat pitch.

// click: strictly two discrete transients — a lower press, a real silent gap, then a
// crisp release — no third layer riding alongside either one. The texture-flick companion
// this used to carry on release added its own onset (even quiet, it's still a separate
// noise transient), which is exactly what reads as a multi-tap flutter instead of one
// clean hit; dropped it entirely, same as every other family's click this pass. Fast 2ms
// attack on both notes for a genuine transient rather than a soft swell. Timing tuned so
// press decays out (ends at 38% of the gesture) well before release fires (starts at 72%)
// — at this family's own click length that's a real ~37ms onset-to-onset gap, matching
// paper-snap's exact-match reference. useDelay:false on both — dry and punchy, no ring-on.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.72, lengthFraction: 0.28, pitchMultiplier: 1.19, volumeMultiplier: 0.55, attack: 0.002, useDelay: false },
];

// congrats: three bubbles blooping upward — root, major third, fifth — each with its own
// gentle upward sweep, spaced with real room to ring rather than a flat 3-note run.
const congratsNotes: Note[] = [
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
const errorNotes: Note[] = [
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

// toggle: two closely-spaced micro-transients, a real minor-third step between them — a
// mechanical latch, not a musical phrase. Dropped the sweep (a glide reads as soft/mushy,
// not a discrete "snap into place") and the legato overlap (first note decays out before
// the second fires instead of blending together). useDelay:false on both — zero reverb,
// immediate feedback. useFilter:false on both — this family's lowpass has its own settling
// time (group delay), which on a note this short ate into a large fraction of the note's
// total duration and softened the onset into a gradual swell instead of an instant snap;
// bypassing it gives the raw tone an unfiltered, instant attack.
// Register raised well above this family's usual 587Hz home (pitchMultiplier 1.8/2.0,
// landing ~1050-1175Hz) — bypassing the filter wasn't enough on its own: a sine burst this
// short only fits ~3-4 cycles at 587Hz, too few for the ear to resolve a clean pitch, which
// is what actually reads as "muffled" (a psychoacoustic floor, not a filtering artifact).
// At ~1.1kHz the same duration holds 7-8 cycles, comfortably above that floor.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1.8, volumeMultiplier: 1, attack: 0.002, useFilter: false, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 2.0, volumeMultiplier: 0.6, attack: 0.002, useFilter: false, useDelay: false },
];

// submit (exact reference match): Cuelume's own "loading" recipe, layer for layer — a soft
// lowpass-noise breath (1400Hz, Q0.6, 35ms attack, 140ms decay) underneath a sine gliding a
// real fifth, 420 -> 630Hz (1 -> 1.5x), 25ms attack, 180ms decay. Uses the per-note attack
// override and inline noise-filter override specifically so this one instance can carry a
// genuinely slow "swell" attack and its own soft noise character — soft-bubble's own
// textureLayer is tuned as a bright bandpass flick for click's release, the wrong character
// for a breath. tone is set to 1.0 so soft-bubble's tone-scaled sweep gimmick doesn't
// attenuate the fifth — this is the one instance that wants the full, unscaled glide, not a
// softened one. Volumes solved to match Cuelume's own post-gain-stage amplitudes (~0.084
// tone / ~0.059 noise), the same approach used for chime's exact-match congrats baseline.
const submitNotes: Note[] = [
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
const notificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// listening: tick, an octave glide, then a landing tone a further fifth up (1:2:3, same
// harmonic series as this instance's reference across every family — see families/snap.ts).
// Glide filtered (this family's own lowpass colors it as it climbs); landing unfiltered so
// the "locked on" resolve reads clean. First pass — not yet validated by ear.
const listeningNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.12, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, attack: 0.001 },
  { offsetFraction: 0.06, lengthFraction: 0.55, pitchMultiplier: 1, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.55, lengthFraction: 0.45, pitchMultiplier: 3, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
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
  waveform: 'sine',
  baseFrequency: 587, // D5
  filterType: 'lowpass',
  // Was [1200, 2600] — entirely above this family's own register (most instances land
  // 560-880Hz; toggle's raised ~1060-1175Hz notes bypass the filter with useFilter:false
  // regardless), so the lowpass never actually attenuated anything and `tone` was
  // inaudible. Lowered so the range now crosses the family's real register: low tone
  // genuinely muffles/absorbs the tone (a "soft, sunken" pop), high tone opens it up
  // clean — giving this family its own distinct envelope-driven character (per the
  // "warm, round, gentle" brief) instead of reading as an unfiltered sine like chime.
  filterCutoffRange: [700, 1600],
  filterQ: 0.7, // was 0.8 — a touch gentler roll-off, rounder rather than resonant.
  // lowpass was 2800 — darkened so the echo tail itself reads as cushioned/absorbed
  // rather than a bright ping, reinforcing the same "soft" quality as the filter above.
  delay: { time: 0.09, feedback: 0.22, wet: 0.18, lowpass: 2200 },
  // Bright noise "glint" for click's release — Cuelume's release recipe is mostly a
  // bright filtered-noise flick, not a pitch sweep; a pure sine sweep alone can't
  // produce that broadband crispness. Kept quiet/brief, an accent under the tonal sweep.
  textureLayer: { filterType: 'bandpass', filterCutoff: 3200, filterQ: 2.5, volumeMultiplier: 0.42, lengthFraction: 0.24 },
  toneScalesSweep: true,
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.18, 0.011, 0.45, 'hover', hoverNote),
  click: preset(0.24, 0.052, 0.42, 'click', clickNotes),
  // 220ms, up from 160ms — 3 real-interval notes need more room than the old flat
  // arpeggio timing gave them.
  congrats: preset(0.3, 0.22, 0.5, 'congrats', congratsNotes),
  // 140ms, up from 55ms — a 3-element compound (knock + 2 tones) needs real room; the
  // old single swept note fit in 55ms because it was just one continuous motion.
  error: preset(0.22, 0.2, 0.25, 'error', errorNotes),
  toggle: preset(0.22, 0.024, 0.42, 'toggle', toggleNotes),
  // high tone so the tone-scaled sweep gimmick still delivers a real fifth-ish lift
  // rather than a token wobble (softBubble's sweep magnitude scales with tone).
  submit: preset(0.084, 0.205, 1.0, 'submit', submitNotes),
  notification: preset(0.2, 0.4, 0.5, 'notification', notificationNotes),
  listening: preset(0.22, 0.32, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const softBubble: SoundFamilyModule = { name: 'soft-bubble', recipe, presets };
export default softBubble;
