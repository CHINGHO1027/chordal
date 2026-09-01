import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// --- tiny-sparkle: bespoke per-instance gestures — quick, bright, and light, distinct
// from every other family's timing by being genuinely fast rather than just quiet.

// click: strictly two discrete transients — a very light press at the root, a real
// silent gap, then release leaps a real fifth up — no third layer riding alongside
// either one. Dropped the texture-flick companion this used to carry on release: even
// quiet, it's a separate noise onset, which reads as a multi-tap flutter rather than one
// clean hit — the fifth interval alone already carries plenty of "up." No sweep. Fast 2ms
// attack on both notes. Timing tuned so press decays out (39%) well before release fires
// (71%) — at this family's own click length that's a real ~30ms onset-to-onset gap, the
// tightest of any family (matching this family's genuinely-fast identity) while still
// landing inside paper-snap's exact-match reference range. useDelay:false on both — dry
// and punchy, no ring-on.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.39, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.71, lengthFraction: 0.29, pitchMultiplier: 1.5, volumeMultiplier: 0.55, attack: 0.002, useDelay: false },
];

// success: tuned toward Cuelume's own sparkle recipe — root/third/fifth/octave was
// already our interval choice, and it turns out to be exactly theirs too (1760/2217/
// 2637/3520Hz reduce to the same 1/1.26/1.5/2 ratios). Two things weren't: their notes
// enter on even 45ms spacing with each note's own decay actually growing (90/90/100/120ms)
// rather than our proportionally-fixed fractions, and — the real character difference —
// they diminuendo (first note loudest, each next one quieter: 1.0/0.89/0.84/0.71). Ours
// crescendo'd toward the octave, which reads as "building up" rather than Cuelume's "one
// clear hit scattering into shimmer." offsetFraction/lengthFraction below are solved
// against a 280ms total so the raw timing matches their real ms values.
const successNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.3214, pitchMultiplier: 1, volumeMultiplier: 1 },
  { offsetFraction: 0.1607, lengthFraction: 0.3214, pitchMultiplier: 1.26, volumeMultiplier: 0.89 },
  { offsetFraction: 0.3214, lengthFraction: 0.3571, pitchMultiplier: 1.5, volumeMultiplier: 0.84 },
  { offsetFraction: 0.4821, lengthFraction: 0.4286, pitchMultiplier: 2, volumeMultiplier: 0.71 },
];

// toggle: two closely-spaced micro-transients, a real descending major third — the
// tightest of any family's toggle, matching this family's genuinely-fast identity. First
// note decays out before the second fires (a real gap instead of legato overlap).
// useDelay:false on both — zero reverb.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 0.79, volumeMultiplier: 0.6, attack: 0.002, useDelay: false },
];

// sent: same loading-recipe structure, quickest attacks of any family (still well clear
// of flutter territory, matching this family's own established "fast" identity). Preset
// tone is pinned low (0.1) rather than this family's usual mid-range — its highpass cutoff
// climbs toward the top of filterCutoffRange at tone=1, and pitchMultiplier 1.15 only
// clears the cutoff at this low tone value (same margin as before the family's register
// was transposed — see filterCutoffRange's own comment); going any higher risked the same
// silence bug glass-crystal's highpass had.
const sentNotes: Note[] = [
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
const notificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 0.55, volumeMultiplier: 1, useFilter: false, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 0.55, volumeMultiplier: 0.83, useFilter: false, detuneCents: 15, attack: 0.06 },
];

// error: tiny-sparkle's delicate brightness had the same problem as glass-crystal/
// soft-bubble — a plain major-third descent read as pretty, not "wrong." Rebuilt with a
// genuine double-tap knock (two muted pulses ~34ms apart) and the descent widened to a
// real dissonant tritone (0.7071). useFilter:false on the tones still sidesteps this
// family's highpass entirely.
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

// listening: same timing skeleton as snap's exact Cuelume "ready" match (see
// families/snap.ts) — a tick at Q1.8 (their own tick's Q, tighter than this family's
// usual texture-layer Q) at 0-29ms, a real octave glide from 12ms lasting 120ms, then a
// landing tone from 130ms with a longer decay, 360ms total. Register and texture stay
// this family's own: the tick reuses this family's own textureLayer cutoff (6200Hz, not
// their literal 3600) and the glide/landing keep this family's own P=0.5 register
// (dialed down from the family's own 1568Hz base so the landing tone doesn't push into
// an extreme high register) rather than their literal 330/660/990Hz — own identity,
// their pattern. sweepTo corrected to 2 (a real octave, 784Hz -> 1568Hz) — it was
// previously 1, which left the glide note statically pitched with no sweep at all. Glide
// filtered (this family's own highpass still passes it cleanly); landing unfiltered so
// the "locked on" resolve reads clean.
const listeningNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.08,
    pitchMultiplier: 0.5,
    volumeMultiplier: 0.5,
    useTexture: { filterType: 'bandpass', filterCutoff: 6200, filterQ: 1.8 },
    attack: 0.001,
  },
  { offsetFraction: 0.0333, lengthFraction: 0.3333, pitchMultiplier: 0.5, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.3611, lengthFraction: 0.6389, pitchMultiplier: 1.5, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
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
    useTexture: { filterType: 'lowpass', filterCutoff: 2400, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'sine',
  // Was 1040 — essentially unison with glass-crystal's 1046Hz, which was most of why
  // the two read as the same family at different volumes rather than distinct
  // identities, independent of any filter shaping. Raised to G6, a clean fifth above
  // glass-crystal's C6, so the register itself is unmistakably this family's own.
  // filterCutoffRange below is scaled by the exact same ratio (1568/1040) so every
  // instance's existing safety margin — including sent's documented low-tone-only
  // workaround — stays geometrically identical, just transposed up with it.
  baseFrequency: 1568,
  filterType: 'highpass',
  filterCutoffRange: [1568, 3380],
  // Pushed toward broadband/airy rather than glass-crystal's resonant peak — no single
  // "singing" frequency, just an open, breathy brightness. This is the actual
  // differentiator between the two now; before, both families used near-identical
  // highpass+moderate-Q, which is most of why they read as interchangeable.
  qRange: [0.6, 2.5],
  // Nudged toward Cuelume's own sparkle shimmer, then pushed further — faster and denser
  // than glass-crystal's single slow ring, more like a flurry of quick glints.
  delay: { time: 0.045, feedback: 0.4, wet: 0.26, lowpass: 6200 },
  textureLayer: { filterType: 'bandpass', filterCutoff: 6200, filterQ: 3, volumeMultiplier: 0.4, lengthFraction: 0.2 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.15, 0.008, 0.2, 'hover', hoverNote),
  click: preset(0.22, 0.042, 0.2, 'click', clickNotes),
  // 280ms — matches Cuelume's own sparkle's real total span (last note starts at 135ms,
  // decays 120ms, ≈255ms) now that the notes carry their real individual decay times
  // instead of a compressed fixed fraction. Volume kept in family (still the loudest of
  // tiny-sparkle's own 5 instances, same as every other family's success) rather than
  // matching Cuelume's sparkle-is-half-as-loud-as-their-chime ratio — that ratio compares
  // two different Cuelume recipes, not analogous to success vs. its own family's hover.
  success: preset(0.28, 0.28, 0.32, 'success', successNotes),
  error: preset(0.2, 0.19, 0.12, 'error', errorNotes),
  toggle: preset(0.2, 0.016, 0.2, 'toggle', toggleNotes),
  // shortest sent of any family, still well clear of flutter territory (150ms vs
  // click's 6ms release), matching tiny-sparkle's own "quick" identity. tone pinned to
  // 0.1 — see sentNotes above for why (highpass-cutoff safety).
  sent: preset(0.19, 0.15, 0.1, 'sent', sentNotes),
  notification: preset(0.15, 0.4, 0.1, 'notification', notificationNotes),
  listening: preset(0.22, 0.36, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const tinySparkle: SoundFamilyModule = { name: 'tiny-sparkle', recipe, presets };
export default tinySparkle;
