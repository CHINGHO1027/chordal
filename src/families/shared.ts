/**
 * Genuinely cross-family building blocks — used by more than one family module, so kept
 * here once instead of duplicated (or, worse, imported from another family's own file,
 * which would defeat per-family tree-shaking).
 */

import type { InstancePreset, Note, SoundInstance } from '../types';

// Pitch offsets applied uniformly across families per instance. hover and click keep their
// established split (hover sits above the family's home register, light/weightless; click
// sits into it, grounded) — that contrast wasn't the issue.
//
// success is deliberately kept as the family's bright peak (its own note-level intervals
// already climb up to an octave above this baseline). What was wrong: click and especially
// error sat far enough below success's baseline, and their own note-level intervals
// compound further downward from there, that the family's overall register spread (error's
// lowest note to success's highest) could reach 1.5-1.7 octaves — wide enough to stop
// reading as one voice. Raised click and error toward the family's center so they still stay
// clearly the "grounded"/"muted" instances relative to hover and success, just without
// dragging the whole family's floor down so far.
const INSTANCE_PITCH: Record<SoundInstance, number> = {
  hover: 1.08,
  click: 0.96,
  success: 1.05,
  error: 0.91,
  toggle: 1.0,
  // Neutral start — the fifth-glide each family's own sent notes carry it upward regardless.
  sent: 1.0,
  // Neutral — bloom has no directional pitch movement at all, just a static detuned pair.
  notification: 1.0,
  // Neutral — the tick-glide-landing shape's own note-level pitchMultipliers (1x/2x/3x, a
  // harmonic series) carry the "rising, locking on" character regardless of this baseline,
  // same reasoning as sent above.
  listening: 1.0,
  // Neutral — a noise-based flick+crackle texture; pitch multiplier barely matters to its
  // character, same reasoning as error/toggle's own knock layers.
  delete: 1.0,
};

export function preset(volume: number, length: number, tone: number, instance: SoundInstance, notes: Note[]): InstancePreset {
  return { volume, length, tone, pitch: INSTANCE_PITCH[instance], notes };
}

// hover: genuinely dry — no shimmer tail. A family's shimmer feedback tail runs for a
// fixed duration independent of note length (see engine.shimmerTailSeconds), so without
// useDelay:false an "instant" 8-12ms hover would still trail hundreds of ms of tail behind
// it — the same latent issue chime had before its shimmer was fixed, just never addressed
// for the other families' hover. Click keeps its family's shimmer as its "solid body";
// hover doesn't get one — it's a weightless probe, not a struck object.
//
// Shared by every family except snap (its own Q3.5 bandpass attenuates a plain sine enough
// to need its own compensated note — see families/snap.ts) and digital-blip (spreads this
// in as the base layer of its own grittier hover, see families/digital-blip.ts).
export const hoverNote: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1, useDelay: false }];
