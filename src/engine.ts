/**
 * Chordal core synthesis engine.
 * Zero audio files — every sound is built from native Web Audio nodes at play time.
 */

export type Waveform = OscillatorType | 'noise';

export interface SynthParams {
  waveform: Waveform;
  /** Start frequency in Hz. Ignored for noise. */
  frequency: number;
  /** Optional end frequency for a pitch sweep/glide over `length`. */
  endFrequency?: number;
  filterType?: BiquadFilterType;
  filterCutoff?: number;
  filterQ?: number;
  /** 0–1 */
  volume: number;
  /** Seconds */
  length: number;
  detuneCents?: number;
  /** Short internal feedback delay, e.g. for the deep-space family's tail. */
  delay?: { time: number; feedback: number };
}

interface Voice {
  stop: (fadeMs?: number) => void;
  endsAt: number;
}

interface ThrottleState {
  lastTriggerAt: number;
  retriggerCount: number;
}

const MAX_VOICES_PER_INSTANCE = 8;
const DUCK_RESET_MS = 150;
const DUCK_DECAY = 0.85;
const DUCK_FLOOR = 0.3;
const DETUNE_STEP_CENTS = 2;
const DETUNE_MAX_CENTS = 12;
const MIN_COOLDOWN_MS = 20;
const COOLDOWN_RATIO = 0.6;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let noiseBuffer: AudioBuffer | null = null;

const voicePools = new Map<string, Voice[]>();
const throttleStates = new Map<string, ThrottleState>();

/** Lazily creates the singleton AudioContext and wires up auto-unlock on first gesture. */
export function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    if (ctx.state === 'suspended') {
      attachAutoUnlock(ctx);
    }
  }
  return ctx;
}

/** The single GainNode all voices route through — playground/analysis code can tap it. */
export function getMasterGain(): GainNode {
  getContext();
  // getContext() always assigns masterGain before returning.
  return masterGain as GainNode;
}

function attachAutoUnlock(context: AudioContext): void {
  const resume = (): void => {
    void context.resume();
    window.removeEventListener('click', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('click', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const durationSeconds = 1;
  const buffer = context.createBuffer(1, context.sampleRate * durationSeconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/** Builds and plays one synthesis voice: source → envelope → (filter) → (delay) → output. */
function synthesize(context: AudioContext, output: AudioNode, params: SynthParams): Voice {
  const now = context.currentTime;
  const { waveform, frequency, endFrequency, filterType, filterCutoff, filterQ, volume, length, detuneCents = 0, delay } = params;

  let source: OscillatorNode | AudioBufferSourceNode;
  if (waveform === 'noise') {
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = getNoiseBuffer(context);
    bufferSource.loop = true;
    source = bufferSource;
  } else {
    const osc = context.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(Math.max(frequency, 1), now);
    if (endFrequency && endFrequency !== frequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), now + length);
    }
    osc.detune.setValueAtTime(detuneCents, now);
    source = osc;
  }

  const envelope = context.createGain();
  const attack = Math.min(0.005, length * 0.2);
  const release = Math.max(length - attack, 0.001);
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(Math.max(volume, 0.0001), now + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

  source.connect(envelope);
  let chainEnd: AudioNode = envelope;

  if (filterType) {
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterCutoff ?? 2000, now);
    filter.Q.setValueAtTime(filterQ ?? 1, now);
    chainEnd.connect(filter);
    chainEnd = filter;
  }

  chainEnd.connect(output);

  if (delay) {
    const delayNode = context.createDelay(1);
    delayNode.delayTime.value = delay.time;
    const feedback = context.createGain();
    feedback.gain.value = delay.feedback;
    chainEnd.connect(delayNode);
    delayNode.connect(feedback);
    feedback.connect(delayNode);
    delayNode.connect(output);
  }

  const stopAt = now + attack + release + 0.02;
  source.start(now);
  source.stop(stopAt);

  const stop = (fadeMs = 5): void => {
    const t = context.currentTime;
    envelope.gain.cancelScheduledValues(t);
    envelope.gain.setValueAtTime(envelope.gain.value, t);
    envelope.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
    try {
      source.stop(t + fadeMs / 1000 + 0.01);
    } catch {
      // already scheduled to stop — nothing to do
    }
  };

  return { stop, endsAt: stopAt };
}

/**
 * Applies the length-relative throttle: retriggering an instance within its cooldown
 * window ducks volume (floor 0.3×) and nudges pitch (up to 12 cents), recovering once
 * 150ms passes without a retrigger.
 */
function applyThrottle(instanceKey: string, params: SynthParams): { volume: number; detuneCents: number } {
  const context = getContext();
  const now = context.currentTime * 1000;
  const cooldownMs = Math.max(MIN_COOLDOWN_MS, params.length * 1000 * COOLDOWN_RATIO);
  const state = throttleStates.get(instanceKey);

  if (!state || now - state.lastTriggerAt > DUCK_RESET_MS) {
    throttleStates.set(instanceKey, { lastTriggerAt: now, retriggerCount: 0 });
    return { volume: params.volume, detuneCents: params.detuneCents ?? 0 };
  }

  if (now - state.lastTriggerAt < cooldownMs) {
    state.retriggerCount += 1;
  }
  state.lastTriggerAt = now;

  const duckedVolume = Math.max(params.volume * Math.pow(DUCK_DECAY, state.retriggerCount), params.volume * DUCK_FLOOR);
  const duckedDetune = Math.min((params.detuneCents ?? 0) + DETUNE_STEP_CENTS * state.retriggerCount, DETUNE_MAX_CENTS);

  return { volume: duckedVolume, detuneCents: duckedDetune };
}

/**
 * Plays one voice for a given instance (e.g. "cyber-electric:hover"), applying the
 * throttle/ducking rule and enforcing the 8-voice polyphony cap via oldest-voice stealing.
 */
export function playVoice(instanceKey: string, params: SynthParams): void {
  const context = getContext();
  const output = getMasterGain();
  const now = context.currentTime;

  const pool = voicePools.get(instanceKey) ?? [];
  const live = pool.filter((voice) => voice.endsAt > now);

  if (live.length >= MAX_VOICES_PER_INSTANCE) {
    const oldest = live.shift();
    oldest?.stop(5);
  }

  const { volume, detuneCents } = applyThrottle(instanceKey, params);
  const voice = synthesize(context, output, { ...params, volume, detuneCents });
  live.push(voice);
  voicePools.set(instanceKey, live);
}

export function mute(): void {
  muted = true;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
  }
}

export function unmute(): void {
  muted = false;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
  }
}

export function isMuted(): boolean {
  return muted;
}
