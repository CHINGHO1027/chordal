import type { FamilyRecipe, InstancePreset, Note, SoundFamilyModule, SoundInstance } from '../types';
import { preset } from './shared';

// snap hover: own note (rather than the generic hoverNote every other family uses)
// because this family's own Q3.5 bandpass attenuates a plain triangle wave enough to read
// as noticeably quieter than other families' hover at the same nominal volume — same root
// cause as click/toggle below. useFilter:false removes that attenuation at its source.
const hoverNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1.15, useFilter: false, useDelay: false }];

// snap click: strictly two discrete transients — press sits low (weighted), a real
// silent gap, then release snaps up a real fourth — no third layer riding alongside
// either one. Dropped the texture-flick companion this used to carry on release: even
// quiet, it's a separate noise onset, which reads as a multi-tap flutter rather than one
// clean snap. No sweep. Fast 2ms attack on both notes. Timing tuned so press decays out
// (39%) well before release fires (71%) — at this family's own click length that's a real
// ~34ms onset-to-onset gap, matching paper-snap's exact-match reference. volumeMultiplier
// scaled up (not the preset default) to compensate this family's Q3.5 bandpass, which
// attenuates the fundamental and this triangle wave's naturally weak harmonics — the same
// nominal `volume` as other families' click was reading noticeably quieter here, and
// compensating with volumeMultiplier alone wasn't enough headroom to fix it without risking
// the shared limiter (pushing a single note's peak close to its -8dB threshold). useFilter:
// false removes the attenuation at its source — the raw triangle wave's own energy, not a
// narrow slice of it — so a much smaller volumeMultiplier now reaches the same loudness.
const clickNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.39, pitchMultiplier: 0.96, volumeMultiplier: 1.1, attack: 0.002, useFilter: false },
  { offsetFraction: 0.71, lengthFraction: 0.29, pitchMultiplier: 1.3, volumeMultiplier: 0.6, attack: 0.002, useFilter: false },
];

// toggle: own note (this family's own bandpass-attenuation compensation lives here at the
// note level). useFilter:false removes the attenuation at its source (same reasoning as
// clickNotes above) — raw triangle energy, not a narrow filtered slice — so only a modest
// volumeMultiplier is needed on top.
const toggleNotes: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1.15, useFilter: false }];

// submit: same loading-recipe structure, at snap's own triangle-wave register.
const submitNotes: Note[] = [
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
const notificationNotes: Note[] = [
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
const errorNotes: Note[] = [
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

// snap: a real fourth-ish jump on the second hit — still snappy, but with somewhere to land.
const congratsNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.42, pitchMultiplier: 1, volumeMultiplier: 0.8 },
  { offsetFraction: 0.36, lengthFraction: 0.5, pitchMultiplier: 1.33, volumeMultiplier: 1 },
];

// listening (reference family for this instance): snap is chordal's only triangle-wave
// family, matching the waveform Cuelume's own "ready" cue uses for its melodic layer — and
// this family's own textureLayer (3600Hz) already sits almost exactly on their tick's own
// 3600Hz. Three parts: a quick tick (this family's own texture) marking the trigger, a
// triangle note gliding a real octave up (sweepTo, filtered — this family's own bandpass
// colors the sweep as it rises through it), then a landing tone a further fifth above that
// (1:2:3, the same harmonic series their own ready recipe lands on), unfiltered so the
// "locked on" resolve reads clean rather than getting clipped by this family's own narrow
// bandpass. Structurally distinct from congrats above (one continuous glide, not discrete
// stepped notes) so the two are never confusable. First pass — not yet validated by ear.
const listeningNotes: Note[] = [
  { offsetFraction: 0, lengthFraction: 0.12, pitchMultiplier: 1, volumeMultiplier: 0.5, useTexture: true, attack: 0.001 },
  { offsetFraction: 0.06, lengthFraction: 0.55, pitchMultiplier: 1, sweepTo: 2, volumeMultiplier: 0.75, attack: 0.006 },
  { offsetFraction: 0.55, lengthFraction: 0.45, pitchMultiplier: 3, volumeMultiplier: 1, useFilter: false, attack: 0.004 },
];

// delete: adapted to this family's own bright texture register rather than the literal
// paper-snap reference (see families/paper-snap.ts for that). A soft lowpass flick, then
// this family's own textureLayer (3600Hz) as the brighter "crackle," then a tiny unfiltered
// tick — dry throughout (useDelay:false), reading as discarded rather than lingering. One-
// shot, no on/off state, unlike listening above.
const deleteNotes: Note[] = [
  {
    offsetFraction: 0,
    lengthFraction: 0.35,
    pitchMultiplier: 1,
    volumeMultiplier: 0.8,
    useTexture: { filterType: 'lowpass', filterCutoff: 1400, filterQ: 0.7 },
    useDelay: false,
    attack: 0.006,
  },
  { offsetFraction: 0.22, lengthFraction: 0.35, pitchMultiplier: 1, volumeMultiplier: 0.55, useTexture: true, useDelay: false, attack: 0.004 },
  { offsetFraction: 0.42, lengthFraction: 0.3, pitchMultiplier: 2, volumeMultiplier: 0.16, useFilter: false, useDelay: false, attack: 0.002 },
];

export const recipe: FamilyRecipe = {
  waveform: 'triangle',
  baseFrequency: 720,
  filterType: 'bandpass',
  filterCutoffRange: [720, 1620],
  filterQ: 3.5,
  textureLayer: { filterType: 'bandpass', filterCutoff: 3600, filterQ: 3, volumeMultiplier: 0.42, lengthFraction: 0.22 },
};

export const presets: Record<SoundInstance, InstancePreset> = {
  hover: preset(0.18, 0.009, 0.5, 'hover', hoverNotes),
  click: preset(0.24, 0.048, 0.5, 'click', clickNotes),
  // 160ms, up from 100ms — was genuinely the shortest congrats of any family (next
  // shortest was paper-snap at 110ms), not giving the fourth-interval jump room to land.
  congrats: preset(0.3, 0.16, 0.55, 'congrats', congratsNotes),
  // 244ms and 0.2184 volume: exact reference match — see errorNotes. tone is unused
  // (neither tone note reads the interpolated filter now), kept at a neutral value.
  error: preset(0.2184, 0.244, 0.3, 'error', errorNotes),
  toggle: preset(0.23, 0.014, 0.5, 'toggle', toggleNotes),
  submit: preset(0.21, 0.17, 0.45, 'submit', submitNotes),
  notification: preset(0.15, 0.4, 0.45, 'notification', notificationNotes),
  // 320ms — tick, octave glide, and a resolving landing tone all need real room; too fast
  // and the glide reads as a pitch-bent click rather than a genuine sweep.
  listening: preset(0.22, 0.32, 0.5, 'listening', listeningNotes),
  delete: preset(0.24, 0.2, 0.5, 'delete', deleteNotes),
};

const snap: SoundFamilyModule = { name: 'snap', recipe, presets };
export default snap;
