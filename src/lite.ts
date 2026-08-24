/**
 * The lean alternative to importing `chordal` directly: bring only the family module(s)
 * you actually use, and get real per-family tree-shaking instead of paying for all 9.
 *
 *   import chime from 'chordal/chime';
 *   import { createPlayer } from 'chordal/lite';
 *
 *   const { play, bind } = createPlayer(chime);
 *   play('hover');
 *
 * `play(instance, {family})` on the main `chordal` entry accepts a family *name* as a
 * runtime string, which is exactly what makes it impossible for a bundler to prove any of
 * the other 8 families are unused — any call could pass any name. createPlayer() sidesteps
 * that by taking the family *module* you already imported directly, so there's nothing to
 * look up and nothing else to bundle.
 *
 * Tradeoff: bind() here has no per-element family-override support (data-sound-click="x")
 * — there's only ever the one family loaded, so there's nothing to switch to. Reach for the
 * main `chordal` entry if you need that.
 */

import * as engine from './engine';
import { resolveNoteParams, resolveToggleTuning } from './resolve';
import { createBinder } from './bind';
import type { InstanceTuning, Note, SoundFamilyModule, SoundInstance } from './types';

const FALLBACK_NOTE: Note = { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 };

export interface LitePlayOptions extends Partial<InstanceTuning> {
  /** Only meaningful for the `toggle` instance — which state just became active. */
  state?: 'on' | 'off';
}

export interface LitePlayer {
  play(instance: SoundInstance, options?: LitePlayOptions): void;
  bind(root?: ParentNode): void;
}

export function createPlayer(family: SoundFamilyModule): LitePlayer {
  function play(instance: SoundInstance, options: LitePlayOptions = {}): void {
    let base = family.presets[instance];

    if (instance === 'toggle' && options.state) {
      base = { ...base, ...resolveToggleTuning(base, options.state) };
    }

    const tuning: InstanceTuning = {
      volume: options.volume ?? base.volume,
      pitch: options.pitch ?? base.pitch,
      length: options.length ?? base.length,
      tone: options.tone ?? base.tone,
    };

    const activeNotes = base.notes.length > 0 ? base.notes : [FALLBACK_NOTE];
    activeNotes.forEach((note, index) => {
      const instanceKey = `${family.name}:${instance}:${index}`;
      const params = resolveNoteParams(family.recipe, tuning, note);
      const startOffset = note.offsetFraction * tuning.length;
      engine.playVoice(instanceKey, params, startOffset);
    });
  }

  const bind = createBinder(play, { supportsFamilyOverride: false });

  return { play, bind };
}
