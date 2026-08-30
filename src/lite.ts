/**
 * The lean alternative to importing `chordal` directly: bring only the family module(s)
 * you actually use, and get real per-family tree-shaking instead of paying for all 9.
 *
 *   import chime from 'chordal/chime';
 *   import { createPlayer } from 'chordal/lite';
 *
 *   const { play, bind, playContinuous } = createPlayer(chime);
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
import { computeSliderVoices, createSliderState } from './continuous';
import type { InstanceTuning, Note, SoundFamilyModule, SoundInstance } from './types';

const FALLBACK_NOTE: Note = { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 };

export interface LitePlayOptions extends Partial<InstanceTuning> {
  /** Only meaningful for stateful instances (`toggle`, `listening`) — which state just became active. */
  state?: 'on' | 'off';
}

export interface LitePlayer {
  play(instance: SoundInstance, options?: LitePlayOptions): void;
  bind(root?: ParentNode): void;
  /** Continuous, pitch-quantized feedback for a range slider's own `input` event. Same
   *  tick sound as the full `chordal` entry's own playContinuous — see continuous.ts. */
  playContinuous(action: 'slider', valueRatio: number): void;
}

export function createPlayer(family: SoundFamilyModule): LitePlayer {
  function play(instance: SoundInstance, options: LitePlayOptions = {}): void {
    const base = family.presets[instance];

    let tuning: InstanceTuning = {
      volume: options.volume ?? base.volume,
      pitch: options.pitch ?? base.pitch,
      length: options.length ?? base.length,
      tone: options.tone ?? base.tone,
    };

    // Applied after options are merged in — see index.ts's play() for why: a manual pitch
    // override should become the "on" pitch, with "off" still dropping proportionally
    // underneath it, rather than silently collapsing both states to the same sound.
    if ((instance === 'toggle' || instance === 'listening') && options.state) {
      tuning = resolveToggleTuning(tuning, options.state);
    }

    const activeNotes = base.notes.length > 0 ? base.notes : [FALLBACK_NOTE];
    activeNotes.forEach((note, index) => {
      const instanceKey = `${family.name}:${instance}:${index}`;
      const params = resolveNoteParams(family.recipe, tuning, note);
      const startOffset = note.offsetFraction * tuning.length;
      engine.playVoice(instanceKey, params, startOffset);
    });
  }

  const bind = createBinder(play, { supportsFamilyOverride: false });

  // This player's own SliderState — not shared at module scope, so a second
  // createPlayer() call for a different family never shares or fights over this one's
  // debounce/speed feel (see continuous.ts's own comment).
  const sliderState = createSliderState();

  function playContinuous(action: 'slider', valueRatio: number): void {
    if (action !== 'slider') return;
    const voices = computeSliderVoices(family.recipe, family.presets.hover, valueRatio, sliderState);
    if (!voices) return;
    engine.playVoice(`${family.name}:slider-body`, voices.body, 0, { maxVoices: 2 });
    engine.playVoice(`${family.name}:slider-click`, voices.click, 0, { maxVoices: 2 });
  }

  return { play, bind, playContinuous };
}
