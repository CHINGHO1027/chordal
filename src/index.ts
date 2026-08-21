/**
 * Chordal public API — play(), playContinuous(), bind(), and the active-family
 * setting. This is the only module consumers should import from directly.
 */

import * as engine from './engine';
import type { SynthParams } from './engine';
import {
  PRESETS,
  FAMILY_RECIPES,
  SOUND_FAMILIES,
  SOUND_INSTANCES,
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

// Major pentatonic scale (equal-tempered), spanning about 1.5 octaves — quantizes slider
// drag into discrete, musical steps instead of a continuous frequency sweep, which is
// what made it sound like a siren/mechanical sweep rather than an instrument.
const PENTATONIC_RATIOS = [1, 1.1225, 1.2599, 1.4983, 1.6818, 2, 2.245];

const SLIDER_DEBOUNCE_MS = 20;
let lastSliderTriggerAt = 0;
let lastSliderRatio: number | null = null;
let lastSliderTimestamp = 0;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Continuous pitch mapping for range sliders — a dedicated dual-layer "tick" rather than
 * inheriting the active family's own (sometimes harsh/electronic) waveform:
 *   - Layer 1: a 5ms pink-noise burst for tactile click. Pink, not white — energy falls
 *     off toward high frequencies, so it reads as a soft tap rather than a hiss.
 *   - Layer 2: a lowpass sine for body, with a closing-filter decay tail (the cutoff
 *     sweeps down over the note instead of holding a fixed brightness) and a random
 *     ±10¢ detune per tick so repeated notes don't sound identically robotic.
 * Pitch is quantized to a pentatonic scale anchored on the family's own register, not
 * swept continuously. A 20ms hard debounce plus a 2-voice cap per layer (fast exponential
 * fade on the older voice — see engine.ts's playVoice `maxVoices`) keep rapid dragging
 * from overlapping into clipping. Movement speed (how fast the ratio is changing between
 * calls) nudges the body's filter brightness — fast drags open up, slow ones stay soft —
 * for a gesture-responsive feel instead of a fixed timbre regardless of how it's played.
 */
export function playContinuous(action: 'slider', valueRatio: number, options: { family?: SoundFamily } = {}): void {
  if (action !== 'slider') return;

  const t = now();
  if (t - lastSliderTriggerAt < SLIDER_DEBOUNCE_MS) return;

  const ratio = Math.min(Math.max(valueRatio, 0), 1);
  let speed = 0;
  if (lastSliderRatio !== null && lastSliderTimestamp) {
    const dtSeconds = Math.max((t - lastSliderTimestamp) / 1000, 0.001);
    speed = Math.min(Math.abs(ratio - lastSliderRatio) / dtSeconds / 4, 1);
  }
  lastSliderRatio = ratio;
  lastSliderTimestamp = t;
  lastSliderTriggerAt = t;

  const family = options.family ?? activeFamily;
  const base = PRESETS[family].hover;
  const root = FAMILY_RECIPES[family].baseFrequency;
  const stepIndex = Math.round(ratio * (PENTATONIC_RATIOS.length - 1));
  const frequency = root * (PENTATONIC_RATIOS[stepIndex] ?? 1);
  const detuneCents = Math.random() * 20 - 10;
  const bodyCutoff = 700 + speed * 2600;
  const bodyLength = Math.max(base.length * 1.4, 0.02);

  const body: SynthParams = {
    waveform: 'sine',
    frequency,
    filterType: 'lowpass',
    filterCutoff: bodyCutoff,
    filterCutoffEnd: bodyCutoff * 0.35,
    filterQ: 0.9,
    volume: base.volume * 0.75,
    length: bodyLength,
    detuneCents,
  };
  engine.playVoice(`${family}:slider-body`, body, 0, { maxVoices: 2 });

  const click: SynthParams = {
    waveform: 'pink-noise',
    frequency: 0,
    filterType: 'lowpass',
    filterCutoff: 2600 + speed * 2000,
    filterQ: 1,
    volume: base.volume * 0.35,
    length: 0.005,
  };
  engine.playVoice(`${family}:slider-click`, click, 0, { maxVoices: 2 });
}

interface BindingConfig {
  attr: string;
  instance: SoundInstance;
  event: string;
}

// One attribute per instance, each firing on the DOM event that instance naturally maps to.
// error binds to the native 'invalid' event — the one real DOM event that already means
// "this input is in an error state" — rather than requiring a bespoke trigger call.
//
// submit and notification both bind to 'click' as a reasonable declarative default, but
// their more typical real usage is programmatic — call play('submit', ...) at the moment
// an async submission actually starts, or play('notification', ...) when a toast/banner
// appears, since neither is a DOM event bind() can observe on its own.
const BINDINGS: BindingConfig[] = [
  { attr: 'data-sound-hover', instance: 'hover', event: 'pointerenter' },
  { attr: 'data-sound-click', instance: 'click', event: 'pointerdown' },
  { attr: 'data-sound-congrats', instance: 'congrats', event: 'click' },
  { attr: 'data-sound-error', instance: 'error', event: 'invalid' },
  { attr: 'data-sound-toggle', instance: 'toggle', event: 'click' },
  { attr: 'data-sound-submit', instance: 'submit', event: 'click' },
  { attr: 'data-sound-notification', instance: 'notification', event: 'click' },
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
