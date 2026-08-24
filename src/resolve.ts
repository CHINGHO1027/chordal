/**
 * Pure resolution functions — turn a family's recipe + an instance's tuning + one note
 * into concrete engine.SynthParams. No AudioContext access, and no dependency on any
 * specific family's data: everything here takes a FamilyRecipe as a plain argument rather
 * than looking one up by name, so this module (and anything that only imports from it) never
 * pulls in every family's data just to resolve one.
 */

import type { SynthParams } from './engine';
import type { FamilyRecipe, InstanceTuning, Note } from './types';

const TOGGLE_PITCH_BY_STATE: Record<'on' | 'off', number> = { on: 1, off: 0.82 };

/**
 * A stateful instance's "off" sits noticeably lower than "on" — the two states should read
 * as distinct without needing a whole separate note shape per state. Used by both `toggle`
 * (a UI switch flipping) and `listening` (a mic/voice-input session starting and stopping) —
 * anything with a genuine on/off lifecycle, not just the literally-named toggle instance.
 */
export function resolveToggleTuning(base: InstanceTuning, state: 'on' | 'off'): InstanceTuning {
  return { ...base, pitch: base.pitch * TOGGLE_PITCH_BY_STATE[state] };
}

export function getPitchRange(recipe: FamilyRecipe): [number, number] {
  return recipe.pitchRange ?? [0.8, 1.4];
}

/**
 * Resolves one note of an instance's gesture into concrete engine.SynthParams.
 * Pure function — no AudioContext access. soft-bubble's "distinguishing gimmick" is a
 * glide that scales its magnitude by `tone` rather than using a fixed amount (see
 * FamilyRecipe.toneScalesSweep), per the synthesis recipe. A note with `useTexture`
 * resolves from the family's fixed textureLayer instead — a transient accent, not
 * tone-sculpted.
 */
export function resolveNoteParams(recipe: FamilyRecipe, tuning: InstanceTuning, note: Note): SynthParams {
  const toneT = Math.min(Math.max(tuning.tone, 0), 1);

  const noteLength = Math.max(tuning.length * note.lengthFraction, 0.005);
  const noteVolume = Math.min(Math.max(tuning.volume * note.volumeMultiplier, 0), 1);
  const pitchMultiplier = tuning.pitch * note.pitchMultiplier;
  const delay = note.useDelay === false ? undefined : recipe.delay;

  if (note.useTexture && typeof note.useTexture === 'object') {
    const ov = note.useTexture;
    return {
      waveform: 'noise',
      frequency: 0,
      filterType: ov.filterType,
      filterCutoff: ov.filterCutoff,
      filterQ: ov.filterQ ?? 1,
      volume: noteVolume,
      length: noteLength,
      attack: note.attack,
      detuneCents: note.detuneCents ?? 0,
    };
  }

  if (note.useTexture && recipe.textureLayer) {
    const tex = recipe.textureLayer;
    return {
      waveform: 'noise',
      frequency: 0,
      filterType: tex.filterType,
      filterCutoff: tex.filterCutoff,
      filterQ: tex.filterQ ?? 1,
      volume: Math.min(Math.max(noteVolume * tex.volumeMultiplier, 0), 1),
      length: Math.max(noteLength * tex.lengthFraction, 0.003),
      detuneCents: note.detuneCents ?? 0,
    };
  }

  const [cutoffLow, cutoffHigh] = recipe.filterCutoffRange;
  const filterCutoff = cutoffLow + (cutoffHigh - cutoffLow) * toneT;
  const filterQ = recipe.qRange ? recipe.qRange[0] + (recipe.qRange[1] - recipe.qRange[0]) * toneT : recipe.filterQ ?? 1;
  const waveform = note.waveformOverride ?? recipe.waveform;

  if (waveform === 'noise' || waveform === 'pink-noise') {
    return {
      waveform,
      frequency: 0, // unused for noise sources
      filterType: recipe.filterType,
      filterCutoff: recipe.baseFrequency * pitchMultiplier,
      filterQ,
      volume: noteVolume,
      length: noteLength,
      attack: note.attack,
      delay,
      detuneCents: note.detuneCents ?? 0,
    };
  }

  const frequency = recipe.baseFrequency * pitchMultiplier;

  let sweepTo = note.sweepTo;
  if (sweepTo !== undefined && recipe.toneScalesSweep) {
    sweepTo = 1 + (sweepTo - 1) * toneT;
  }

  const useFilter = note.useFilter !== false;

  return {
    waveform,
    frequency,
    endFrequency: sweepTo !== undefined ? frequency * sweepTo : undefined,
    filterType: useFilter ? recipe.filterType : undefined,
    filterCutoff: useFilter ? filterCutoff : undefined,
    filterQ: useFilter ? filterQ : undefined,
    volume: noteVolume,
    length: noteLength,
    attack: note.attack,
    delay,
    detuneCents: note.detuneCents ?? 0,
  };
}

/**
 * Whether adjusting `tone` produces any audible difference for this recipe/notes at the
 * given tuning. `tone` only moves a filter's cutoff (see resolveNoteParams above) — a filter
 * can only shape harmonic content that actually exists in the signal. A pure sine has none
 * beyond its one fundamental, so a lowpass/highpass positioned entirely on one side of that
 * fundamental across the whole 0-1 tone range is inaudible no matter where tone sits. Square,
 * triangle, and noise sources carry real harmonic/broadband content a moving filter can shape,
 * so those are treated as responsive whenever their filter is active. A recipe with
 * toneScalesSweep is a second, independent path tone can affect audibly, checked separately
 * since it doesn't go through the filter at all.
 */
export function isToneAudible(recipe: FamilyRecipe, notes: Note[], tuning: InstanceTuning): boolean {
  const [cutoffLow, cutoffHigh] = recipe.filterCutoffRange;

  return notes.some((note) => {
    if (recipe.toneScalesSweep && note.sweepTo !== undefined) return true;
    if (note.useFilter === false) return false;
    // Texture-layer notes carry their own fixed inline cutoff (see the useTexture branches
    // above) — tone never reaches them.
    if (note.useTexture) return false;

    const waveform = note.waveformOverride ?? recipe.waveform;
    if (waveform !== 'sine') return true;

    const fundamental = recipe.baseFrequency * tuning.pitch * note.pitchMultiplier;
    if (recipe.filterType === 'lowpass') return cutoffLow <= fundamental * 1.3;
    if (recipe.filterType === 'highpass') return cutoffHigh >= fundamental * 0.77;
    return true;
  });
}
