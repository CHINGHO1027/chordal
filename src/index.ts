/**
 * Chordal public API — play(), playContinuous(), bind(), and the active-family
 * setting. This is the only module consumers should import from directly.
 */

import * as engine from './engine';
import {
  PRESETS,
  SOUND_FAMILIES,
  SOUND_INSTANCES,
  getPitchRange,
  resolveNoteParams,
  resolveToggleTuning,
  type InstanceTuning,
  type Note,
  type SoundFamily,
  type SoundInstance,
} from './presets';

export { SOUND_FAMILIES, SOUND_INSTANCES };
export type { SoundFamily, SoundInstance };
export { mute, unmute, isMuted } from './engine';

const FALLBACK_NOTE: Note = { offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 };

let activeFamily: SoundFamily = 'soft-bubble';

export function setFamily(family: SoundFamily): void {
  activeFamily = family;
}

export function getFamily(): SoundFamily {
  return activeFamily;
}

export interface PlayOptions extends Partial<InstanceTuning> {
  /** Override the active family for this call only. */
  family?: SoundFamily;
  /** Only meaningful for the `toggle` instance — which state just became active. */
  state?: 'on' | 'off';
}

/**
 * Schedules one instance's gesture (one or more notes). Each note gets its own
 * engine instanceKey — `family:instance:noteIndex` — so a multi-note gesture's own
 * notes (e.g. congrats's ascending run) never duck each other via the engine's
 * anti-spam throttle. Repeating the *same* gesture too quickly still ducks correctly,
 * because each note-index slot is throttled against its own previous occurrence.
 *
 * All notes are submitted in one synchronous pass — each carries its own `startOffset`,
 * which the engine schedules against the AudioContext's own clock rather than a JS timer,
 * so a gesture's notes land sample-accurately regardless of event-loop jitter.
 */
function scheduleGesture(family: SoundFamily, instance: SoundInstance, tuning: InstanceTuning, notes: Note[]): void {
  const activeNotes = notes.length > 0 ? notes : [FALLBACK_NOTE];
  activeNotes.forEach((note, index) => {
    const instanceKey = `${family}:${instance}:${index}`;
    const params = resolveNoteParams(family, tuning, note);
    const startOffset = note.offsetFraction * tuning.length;
    engine.playVoice(instanceKey, params, startOffset);
  });
}

/** Plays one instance of the active (or overridden) family, with optional live overrides. */
export function play(instance: SoundInstance, options: PlayOptions = {}): void {
  const family = options.family ?? activeFamily;
  let base = PRESETS[family][instance];

  if (instance === 'toggle' && options.state) {
    base = { ...base, ...resolveToggleTuning(base, options.state) };
  }

  const tuning: InstanceTuning = {
    volume: options.volume ?? base.volume,
    pitch: options.pitch ?? base.pitch,
    length: options.length ?? base.length,
    tone: options.tone ?? base.tone,
  };

  scheduleGesture(family, instance, tuning, base.notes);
}

/**
 * Continuous pitch mapping for range sliders: inherits the active family's `hover`
 * shape and shifts pitch by valueRatio (0–1) across that family's pitch range.
 * Call this on every 'input' event while dragging — each call fires a short hover-length
 * voice at the newly computed pitch, and the engine's own throttle/ducking (keyed
 * separately from plain hover) blends rapid successive calls into a continuous sweep.
 */
export function playContinuous(action: 'slider', valueRatio: number, options: { family?: SoundFamily } = {}): void {
  if (action !== 'slider') return;
  const family = options.family ?? activeFamily;
  const base = PRESETS[family].hover;
  const [lo, hi] = getPitchRange(family);
  const ratio = Math.min(Math.max(valueRatio, 0), 1);
  const pitch = base.pitch * (lo + ratio * (hi - lo));

  const tuning: InstanceTuning = { volume: base.volume, pitch, length: base.length, tone: base.tone };
  const note = base.notes[0] ?? FALLBACK_NOTE;
  const params = resolveNoteParams(family, tuning, note);
  engine.playVoice(`${family}:slider`, params);
}

interface BindingConfig {
  attr: string;
  instance: SoundInstance;
  event: string;
}

// One attribute per instance, each firing on the DOM event that instance naturally maps to.
// error binds to the native 'invalid' event — the one real DOM event that already means
// "this input is in an error state" — rather than requiring a bespoke trigger call.
const BINDINGS: BindingConfig[] = [
  { attr: 'data-sound-hover', instance: 'hover', event: 'pointerenter' },
  { attr: 'data-sound-press', instance: 'press', event: 'pointerdown' },
  { attr: 'data-sound-congrats', instance: 'congrats', event: 'click' },
  { attr: 'data-sound-error', instance: 'error', event: 'invalid' },
  { attr: 'data-sound-toggle', instance: 'toggle', event: 'click' },
];

const boundAttrsByElement = new WeakMap<Element, Set<string>>();

function markBound(el: Element, attr: string): boolean {
  const bound = boundAttrsByElement.get(el) ?? new Set<string>();
  if (bound.has(attr)) return false;
  bound.add(attr);
  boundAttrsByElement.set(el, bound);
  return true;
}

/**
 * Reads on/off state at click time from aria-pressed or a checkbox's checked property.
 * Call bind() after your own toggle logic is wired up so this reads the post-toggle value.
 */
function resolveToggleState(el: Element): 'on' | 'off' {
  if (el.hasAttribute('aria-pressed')) {
    return el.getAttribute('aria-pressed') === 'true' ? 'on' : 'off';
  }
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    return el.checked ? 'on' : 'off';
  }
  return 'on';
}

/**
 * Scans `root` for data-sound-* attributes and wires up listeners automatically.
 * Safe to call more than once (e.g. after DOM mutations) — already-bound elements
 * are skipped rather than double-bound.
 */
export function bind(root: ParentNode = document): void {
  for (const { attr, instance, event } of BINDINGS) {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      if (!markBound(el, attr)) return;
      const familyOverride = el.getAttribute(attr);
      const options: PlayOptions = familyOverride ? { family: familyOverride as SoundFamily } : {};
      el.addEventListener(event, () => {
        if (instance === 'toggle') {
          play(instance, { ...options, state: resolveToggleState(el) });
        } else {
          play(instance, options);
        }
      });
    });
  }
}
