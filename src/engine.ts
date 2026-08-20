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
  /**
   * Internal feedback delay — a shimmer/echo tail applied to this voice.
   * `wet` (0–1, default 1) is the send level into the delay, independent of the dry
   * signal already reaching `output` directly. `lowpass` (default 8000) darkens the
   * feedback path so repeats don't stay full-brightness forever.
   */
  delay?: { time: number; feedback: number; wet?: number; lowpass?: number };
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
const CLEANUP_MARGIN_MS = 30;
const INAUDIBLE_GAIN = 0.001;

/** How long a delay's feedback repeats take to decay below INAUDIBLE_GAIN. */
function shimmerTailSeconds(delay?: SynthParams['delay']): number {
  if (!delay || delay.feedback <= 0) return 0;
  const feedback = Math.min(delay.feedback, 0.999);
  return delay.time * (1 + Math.ceil(Math.log(INAUDIBLE_GAIN) / Math.log(feedback)));
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let noiseBuffer: AudioBuffer | null = null;

const voicePools = new Map<string, Voice[]>();
const throttleStates = new Map<string, ThrottleState>();

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Lazily creates the singleton AudioContext and wires up auto-unlock on first gesture.
 * Returns null in non-browser environments (SSR) or if Web Audio is unavailable —
 * every caller in this module treats that as a silent no-op, never a throw.
 */
export function getContext(): AudioContext | null {
  if (ctx) return ctx;

  ctx = createAudioContext();
  if (!ctx) return null;

  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;

  // A shared limiter on the output bus — without it, the 8-voice polyphony cap can
  // sum past 0dB and clip. Individual instance volumes stay as authored; this only
  // catches the overlap case.
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 6;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.08;

  masterGain.connect(compressor);
  compressor.connect(ctx.destination);

  if (ctx.state === 'suspended') {
    attachAutoUnlock(ctx);
  }
  return ctx;
}

/** The single GainNode all voices route through — playground/analysis code can tap it. */
export function getMasterGain(): GainNode | null {
  getContext();
  return masterGain;
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

/**
 * Builds and plays one synthesis voice: source → envelope → (filter) → (delay) → output.
 * `startOffset` (seconds from now) is scheduled against the AudioContext's own clock via
 * `source.start()`, not a JS timer — so a multi-note gesture's notes land sample-accurately
 * regardless of event-loop jitter. All nodes are explicitly disconnected once the voice
 * (and, if stopped early, its fade-out) has finished, instead of relying on GC alone.
 */
function synthesize(context: AudioContext, output: AudioNode, params: SynthParams, startOffset: number): Voice {
  const startTime = context.currentTime + Math.max(startOffset, 0);
  const { waveform, frequency, endFrequency, filterType, filterCutoff, filterQ, volume, length, detuneCents = 0, delay } = params;

  const nodes: AudioNode[] = [];
  let source: OscillatorNode | AudioBufferSourceNode;
  if (waveform === 'noise') {
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = getNoiseBuffer(context);
    bufferSource.loop = true;
    source = bufferSource;
  } else {
    const osc = context.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(Math.max(frequency, 1), startTime);
    if (endFrequency && endFrequency !== frequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), startTime + length);
    }
    osc.detune.setValueAtTime(detuneCents, startTime);
    source = osc;
  }
  nodes.push(source);

  const envelope = context.createGain();
  nodes.push(envelope);
  const attack = Math.min(0.005, length * 0.2);
  const release = Math.max(length - attack, 0.001);
  envelope.gain.setValueAtTime(0, startTime);
  envelope.gain.linearRampToValueAtTime(Math.max(volume, 0.0001), startTime + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + release);

  source.connect(envelope);
  let chainEnd: AudioNode = envelope;

  if (filterType) {
    const filter = context.createBiquadFilter();
    nodes.push(filter);
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterCutoff ?? 2000, startTime);
    filter.Q.setValueAtTime(filterQ ?? 1, startTime);
    chainEnd.connect(filter);
    chainEnd = filter;
  }

  chainEnd.connect(output);

  if (delay) {
    const delayNode = context.createDelay(1);
    const feedbackFilter = context.createBiquadFilter();
    const feedbackGain = context.createGain();
    const wetGain = context.createGain();
    nodes.push(delayNode, feedbackFilter, feedbackGain, wetGain);

    delayNode.delayTime.value = delay.time;
    feedbackFilter.type = 'lowpass';
    feedbackFilter.frequency.value = delay.lowpass ?? 8000;
    feedbackGain.gain.value = delay.feedback;
    wetGain.gain.value = delay.wet ?? 1;

    chainEnd.connect(delayNode);
    delayNode.connect(feedbackFilter);
    feedbackFilter.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    feedbackFilter.connect(wetGain);
    wetGain.connect(output);
  }

  const stopAt = startTime + attack + release + 0.02;
  source.start(startTime);
  source.stop(stopAt);

  const cleanup = (): void => {
    nodes.forEach((node) => node.disconnect());
  };
  const tailSeconds = shimmerTailSeconds(delay);
  const naturalCleanupDelayMs = Math.max(0, (stopAt + tailSeconds - context.currentTime) * 1000) + CLEANUP_MARGIN_MS;
  const naturalCleanupTimer = setTimeout(cleanup, naturalCleanupDelayMs);

  const stop = (fadeMs = 5): void => {
    clearTimeout(naturalCleanupTimer);
    const t = context.currentTime;
    envelope.gain.cancelScheduledValues(t);
    envelope.gain.setValueAtTime(envelope.gain.value, t);
    envelope.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
    try {
      source.stop(t + fadeMs / 1000 + 0.01);
    } catch {
      // already scheduled to stop — nothing to do
    }
    setTimeout(cleanup, fadeMs + CLEANUP_MARGIN_MS);
  };

  return { stop, endsAt: stopAt };
}

/**
 * Applies the length-relative throttle: retriggering an instance within its cooldown
 * window ducks volume (floor 0.3×) and nudges pitch (up to 12 cents), recovering once
 * 150ms passes without a retrigger.
 */
function applyThrottle(context: AudioContext, instanceKey: string, params: SynthParams): { volume: number; detuneCents: number } {
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
 * Plays one voice for a given instance (e.g. "glass-crystal:hover"), applying the
 * throttle/ducking rule and enforcing the 8-voice polyphony cap via oldest-voice stealing.
 * `startOffset` (seconds) schedules the voice sample-accurately instead of firing immediately —
 * used to lay out a multi-note gesture's notes in one pass against one AudioContext clock read.
 * A no-op before the page's first user gesture, in SSR, and when Web Audio is unavailable.
 */
export function playVoice(instanceKey: string, params: SynthParams, startOffset = 0): void {
  if (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false) return;

  const context = getContext();
  const output = getMasterGain();
  if (!context || !output) return;

  const now = context.currentTime;
  const pool = voicePools.get(instanceKey) ?? [];
  const live = pool.filter((voice) => voice.endsAt > now);

  if (live.length >= MAX_VOICES_PER_INSTANCE) {
    const oldest = live.shift();
    oldest?.stop(5);
  }

  const { volume, detuneCents } = applyThrottle(context, instanceKey, params);
  const voice = synthesize(context, output, { ...params, volume, detuneCents }, startOffset);
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
