import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

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
const successNotes: Note[] = [
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
const clickNotes: Note[] = [
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

// paper-snap sent: sweepTo is ignored for noise (the engine never sweeps a bandpass
// center), so "lifting" here is a discrete two-step bandpass rise (root -> a real fifth)
// instead of a continuous glide — the same substitution already used for its success/click.
// Doesn't need a separate breath layer (this family's whole voice already is noise); the
// slow attack on both steps is what borrows the loading-recipe "swell" quality instead.
const sentNotes: Note[] = [
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
const errorNotes: Note[] = [
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
const notificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.2, volumeMultiplier: 1, waveformOverride: 'sine', useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.2, volumeMultiplier: 0.83, waveformOverride: 'sine', useFilter: false, detuneCents: 12, attack: 0.06 },
];

// toggle: own single note (not the generic sweep-carrying shapes above) — this family's
// whole voice is noise, so toggle just needs one dry hit, no sweep/interval logic to reuse.
const toggleNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 }];

// listening: same overall timing as snap's exact Cuelume "ready" match (see
// families/snap.ts) — the glide's own 12-132ms window, then a landing tone from 130ms
// with a longer decay, 360ms total. Reconsidered from a first pass that had a separate
// leading noise tick ahead of the rise: this whole family's voice is noise, so tick +
// two-step rise + (eventually) landing was three separate noise-reading events in a row
// before any tonal content arrived — reads as "noisy," not "rising." Dropped the tick
// entirely and, borrowing this family's own sentNotes technique (two heavily
// overlapping notes with a slow attack, blending into one continuous swell instead of
// discrete jumps — the same fix already applied to metallic-tact's own breath layer,
// see families/metallic-tact.ts), softened the two-step bandpass rise (root -> a real
// octave) the same way: slower attack (20ms -> 30/35ms) and real overlap between the two
// steps rather than a gap, so the rise reads as one continuous noise-wash climbing into
// the landing rather than two separate knocks. Noise still can't glide a continuous pitch
// (the engine never sweeps a bandpass center — same limitation this family's own sent
// already works around), so this discrete rise still stands in for the smooth glide the
// other 8 families get; then a real sine landing tone (waveformOverride, same technique
// as this family's own error/notification, since noise can't resolve a clean pitch
// either) at a register sized for an actual tone rather than this family's
// noise-bandpass-tuned 3200Hz base.
const listeningNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.2, pitchMultiplier: 1, volumeMultiplier: 0.5, attack: 0.03 },
  { offsetFraction: 0.15, lengthFraction: 0.2166, pitchMultiplier: 2, volumeMultiplier: 0.65, attack: 0.035 },
  {
    offsetFraction: 0.3611,
    lengthFraction: 0.6389,
    pitchMultiplier: 0.3,
    volumeMultiplier: 1,
    waveformOverride: 'sine',
    useFilter: false,
    attack: 0.004,
  },
];

// delete (reference family for this instance): this family's own register and filter
// [2200, 6000] already sit close to Cuelume's own "page" recipe (1800Hz lowpass, 4200Hz
// bandpass), so the flick and crackle below reproduce their literal cutoffs directly —
// the same exact-match technique this family's click/error already use. A soft lowpass
// flick, then a brighter bandpass crackle, then a tiny unfiltered sine tick as an accent
// (page's own quietest layer). No delay field on this family's recipe at all, so nothing
// needs useDelay:false here — there's no shimmer to skip in the first place.
const deleteNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.35,
    pitchMultiplier: 1,
    volumeMultiplier: 0.85,
    useTexture: { filterType: 'lowpass', filterCutoff: 1800, filterQ: 0.7 },
    attack: 0.006,
  },
  {
    offsetFraction: 0.22,
    lengthFraction: 0.3,
    pitchMultiplier: 1,
    volumeMultiplier: 0.6,
    useTexture: { filterType: 'bandpass', filterCutoff: 4200, filterQ: 1.2 },
    attack: 0.004,
  },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 0.75, volumeMultiplier: 0.16, waveformOverride: 'sine', useFilter: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'noise',
  baseFrequency: 3200, // bandpass center, since noise has no fundamental pitch
  filterType: 'bandpass',
  filterCutoffRange: [2200, 6000],
  filterQ: 3,
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.17, 0.008, 0.5, 'hover', hoverNote),
  click: preset(0.26, 0.09, 0.5, 'click', clickNotes),
  // 220ms, up from 110ms — matches the broader success pack now that this is a real
  // 3-note ascending run instead of a 2-note bandpass jump.
  success: preset(0.3, 0.22, 0.55, 'success', successNotes),
  error: preset(0.22, 0.195, 0.3, 'error', errorNotes),
  toggle: preset(0.22, 0.014, 0.5, 'toggle', toggleNotes),
  sent: preset(0.21, 0.16, 0.5, 'sent', sentNotes),
  notification: preset(0.2, 0.4, 0.3, 'notification', notificationNotes),
  listening: preset(0.22, 0.36, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const paperSnap: SoundFamilyModule = { name: 'paper-snap', recipe, presets };
export default paperSnap;
