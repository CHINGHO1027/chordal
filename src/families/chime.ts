import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { hoverNote, preset } from './shared';

// --- chime: bespoke per-instance gestures, not the shared templates. Cuelume's own
// chime is two clean unfiltered sine layers a fifth apart, spaced 90ms with 220-260ms
// of individual decay each — the "bell" comes from real interval + room to ring, not
// from more notes packed tighter. Applied here at chime's own register or without
// literally copying their numbers.

// click: strictly two discrete transients — press sits at the tap (weighted), a real
// silent gap, then release jumps a minor third up (crisp) — no third layer riding
// alongside either one. Dropped the texture-flick companion this used to carry on
// release: even quiet, it's a separate noise onset, which reads as a multi-tap flutter
// rather than one clean hit. No sweep: Cuelume's own release doesn't glide either. Fast
// 2ms attack on both notes. Timing tuned so press decays out (38%) well before release
// fires (72%) — at this family's own click length that's a real ~39ms onset-to-onset gap,
// matching paper-snap's exact-match reference.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.38, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.002, useDelay: false },
  { offsetFraction: 0.72, lengthFraction: 0.28, pitchMultiplier: 1.19, volumeMultiplier: 0.55, attack: 0.002, useDelay: false },
];

// success: baseline matched to Cuelume's own chime recipe — root C6 (1046.5Hz) then a
// fifth up to G6 (1568Hz), second note entering 90ms after the first, each with its own
// attack/decay rather than sharing one envelope. Pitch multipliers are solved against
// chime's 940Hz base register (baseFrequency * success' 1.05 instance pitch = 987Hz) so
// the family's shared register doesn't move, only these two notes land on Cuelume's exact
// frequencies.
//
// Each strike also gets a quiet detuned unison companion (same pitch/timing, ±6-7 cents,
// ~35% volume) — real chorus/beating from two real oscillators, rather than asking the
// delay-based shimmer to be the only source of width. Opposite detune direction on the two
// strikes (+7 then -6) so they don't beat identically.
const successNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.6348, pitchMultiplier: 1.0603, volumeMultiplier: 1 },
  { offsetFraction: 0, lengthFraction: 0.6348, pitchMultiplier: 1.0603, volumeMultiplier: 0.35, detuneCents: 7 },
  { offsetFraction: 0.2528, lengthFraction: 0.7472, pitchMultiplier: 1.5887, volumeMultiplier: 0.8889 },
  { offsetFraction: 0.2528, lengthFraction: 0.7472, pitchMultiplier: 1.5887, volumeMultiplier: 0.311, detuneCents: -6 },
];

// toggle: two closely-spaced micro-transients, a genuine step between them — a mechanical
// latch, not a barely-there wobble or a musical phrase. First note decays out before the
// second fires (a real gap instead of the legato overlap this used to have).
// useDelay:false on both — zero reverb. useFilter:false on both — this family's lowpass
// has its own settling time, which on a note this short softened the onset into a gradual
// swell instead of an instant snap; bypassing it gives the raw tone an instant attack.
// Register raised modestly (pitchMultiplier 1.3/1.07, landing ~1220Hz/1005Hz) — same
// psychoacoustic floor as the other families: a sine burst this short needs to sit near or
// above ~1kHz to resolve a clean pitch rather than reading as a soft thump.
const toggleNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.35, pitchMultiplier: 1.3, volumeMultiplier: 1, attack: 0.002, useFilter: false, useDelay: false },
  { offsetFraction: 0.55, lengthFraction: 0.35, pitchMultiplier: 1.07, volumeMultiplier: 0.75, attack: 0.002, useFilter: false, useDelay: false },
];

// sent: same loading-recipe structure, at chime's own transparent-filter register
// (940Hz, no highpass-safety concern the way glass-crystal/tiny-sparkle have).
const sentNotes: Note[] = [
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
const notificationNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.95, pitchMultiplier: 1, volumeMultiplier: 1, attack: 0.06 },
  { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 0.83, detuneCents: 12, attack: 0.06 },
];

// error: same knock+2-tone pattern as snap's exact Cuelume match, at chime's own 940Hz
// register.
const errorNotes: Note[] = [
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

// listening: same timing skeleton as snap's exact Cuelume "ready" match (see
// families/snap.ts) — a tick at Q1.8 (their own tick's Q, tighter than this family's
// usual texture-layer Q) at 0-29ms, a real octave glide from 12ms lasting 120ms, then a
// landing tone from 130ms with a longer decay, 360ms total. Register and texture stay
// this family's own: the tick reuses this family's own textureLayer cutoff (4600Hz, not
// their literal 3600), and the glide/landing use P=0.75 (dialed down from this family's
// full 940Hz register — landing at pitchMultiplier 3 was landing at 2820Hz, read as too
// shrill) rather than their literal 330/660/990Hz — own identity, their pattern. Sine
// and essentially unfiltered throughout (this family's own filter is already
// near-transparent), so no filter overrides are needed on the glide or landing.
const listeningNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.08,
    pitchMultiplier: 1,
    volumeMultiplier: 0.5,
    useTexture: { filterType: 'bandpass', filterCutoff: 4600, filterQ: 1.8 },
    attack: 0.001,
  },
  { offsetFraction: 0.0333, lengthFraction: 0.3333, pitchMultiplier: 0.75, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.3611, lengthFraction: 0.6389, pitchMultiplier: 2.25, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
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
    useTexture: { filterType: 'lowpass', filterCutoff: 2000, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
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
};

export const presets: Record<SoundInstance, InstancePreset> = {
  // Volumes pulled well below the shared limiter's -8dB (~0.4) threshold — Cuelume's
  // chime notes land around 0.16-0.18 after their own gain staging, comfortably under
  // their limiter too, so a single note never gets compressed. Ours were sitting at or
  // above threshold, so the limiter was squashing almost every chime hit — that
  // gain-reduction pumping is what read as "heavy" next to their untouched transients.
  hover: preset(0.18, 0.012, 0.5, 'hover', hoverNote),
  click: preset(0.23, 0.054, 0.5, 'click', clickNotes),
  // 0.18 volume + 356ms length: solved to land at the exact same final amplitude
  // (~0.18/0.16 post-limiter-headroom) and total decay time as Cuelume's own two chime
  // layers (226ms + 266ms decay, second note entering at the 90ms mark) — see
  // successNotes above for the rest of the mapping.
  success: preset(0.18, 0.356, 0.55, 'success', successNotes),
  error: preset(0.21, 0.16, 0.28, 'error', errorNotes),
  toggle: preset(0.23, 0.024, 0.5, 'toggle', toggleNotes),
  sent: preset(0.2, 0.2, 0.45, 'sent', sentNotes),
  notification: preset(0.2, 0.4, 0.5, 'notification', notificationNotes),
  listening: preset(0.22, 0.36, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const chime: SoundFamilyModule = { name: 'chime', recipe, presets };
export default chime;
