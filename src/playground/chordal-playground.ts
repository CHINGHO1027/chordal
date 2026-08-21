/**
 * <chordal-playground> — framework-agnostic Web Component. Family/instance selectors,
 * 4 live tuning sliders, a test area covering all 5 instances, a live oscilloscope,
 * and a copy-pasteable code snippet. Not part of the core bundle's 5KB budget.
 */

import * as engine from '../engine';
import { play, playContinuous, setFamily, getFamily, mute, unmute, isMuted, SOUND_FAMILIES } from '../index';
import { PRESETS, FAMILY_RECIPES, type InstanceTuning } from '../presets';
import type { SoundFamily, SoundInstance } from '../presets';

const FAMILY_ACCENTS: Record<SoundFamily, string> = {
  'soft-bubble': '#E0668E',
  'glass-crystal': '#4FA8A0',
  'paper-snap': '#5B6472',
  'metallic-tact': '#6E7A8A',
  chime: '#D4A72E',
  'digital-blip': '#2E8FBD',
  spring: '#6FB238',
  'tiny-sparkle': '#C77DD1',
  snap: '#A85A2E',
};

const WAVEFORM_BG = '#FAF7F3';

// `format` gets the family's baseFrequency as context — only 'pitch' uses it, to display
// the multiplier as the actual Hz a listener would recognize rather than an abstract ×.
const SLIDER_SPECS: Array<{ key: keyof InstanceTuning; label: string; min: number; max: number; step: number; format: (v: number, baseFrequency: number) => string }> = [
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}` },
  { key: 'pitch', label: 'Pitch', min: 0.5, max: 2, step: 0.01, format: (v, baseFrequency) => `${Math.round(v * baseFrequency)}Hz` },
  { key: 'length', label: 'Length', min: 0.005, max: 0.4, step: 0.005, format: (v) => `${Math.round(v * 1000)}ms` },
  { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
];

const STYLES = `
  :host {
    --accent: #B86829;
    --page-bg: #FBFAF9;
    --surface: #FFFFFF;
    --waveform-bg: ${WAVEFORM_BG};
    --text-primary: #17110C;
    --text-secondary: #6B5D4E;
    --border: #E8E0D5;
    --radius-sm: 8px;
    --radius-md: 14px;
    --radius-lg: 22px;
    --border-width: 0.8px;
    --font-body: Mulish, system-ui, sans-serif;

    /* type tokens — three sizes; weight never exceeds regular (400). Body copy runs
       light (300), regular is reserved for pane headings only. */
    --text-heading: 0.8125rem;
    --text-body: 0.75rem;
    --text-small: 0.6875rem;
    --weight-light: 300;
    --weight-regular: 400;

    display: block;
    max-width: 60rem;
    margin: 0 auto;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-weight: var(--weight-light);
    font-size: var(--text-body);
    line-height: 1.5;
    box-sizing: border-box;
  }
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) {
    button, .swatch { transition: none !important; }
  }

  .studio {
    display: grid;
    grid-template-columns: 13rem 1fr 16rem;
    gap: var(--border-width);
    background: var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 24px 48px -24px rgba(23, 17, 12, 0.28), 0 2px 8px rgba(23, 17, 12, 0.06);
  }
  .pane { background: var(--surface); padding: 1rem; }
  .pane-head {
    font-family: var(--font-body);
    font-size: var(--text-heading);
    font-weight: var(--weight-regular);
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }
  .family-list { display: flex; flex-direction: column; gap: 0.3rem; }
  .family-btn {
    display: flex; align-items: center; gap: 0.55rem;
    font-family: var(--font-body); font-size: var(--text-body); font-weight: var(--weight-light);
    text-align: left; border: none; background: none; cursor: pointer;
    padding: 0.4rem 0.5rem; border-radius: var(--radius-sm);
    color: var(--text-secondary);
  }
  .family-btn .dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--dot); flex-shrink: 0; }
  .family-btn[aria-pressed="true"] { background: var(--page-bg); color: var(--text-primary); }
  .family-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .waveform-wrap { background: var(--waveform-bg); border-radius: var(--radius-md); padding: 0.5rem; position: relative; }
  canvas { display: block; width: 100%; height: 9rem; }
  .status {
    position: absolute; top: 0.6rem; right: 0.75rem;
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-light);
    color: var(--text-secondary); font-variant-numeric: tabular-nums;
  }

  .test-area { margin-top: 1rem; }
  .instance-group-label { font-size: var(--text-small); color: var(--text-secondary); margin-bottom: 0.5rem; }
  .instance-group { background: var(--waveform-bg); border-radius: var(--radius-sm); padding: 0.7rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .instance-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .instance-divider { height: var(--border-width); background: var(--border); }
  .instance-ctrl-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .instance-ctrl-label { font-size: var(--text-small); color: var(--text-secondary); }

  .switch { position: relative; display: inline-flex; width: 2.1rem; height: 1.15rem; flex-shrink: 0; cursor: pointer; }
  .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .switch-track { position: absolute; inset: 0; border-radius: 999px; background: var(--border); transition: background 0.15s; }
  .switch-knob {
    position: absolute; top: 0.1rem; left: 0.1rem; width: 0.95rem; height: 0.95rem; border-radius: 50%;
    background: var(--surface); box-shadow: 0 1px 3px rgba(23,17,12,0.28); transition: transform 0.15s;
  }
  .switch input:checked ~ .switch-track { background: var(--accent); }
  .switch input:checked ~ .switch-track .switch-knob { transform: translateX(0.95rem); }
  .switch input:focus-visible ~ .switch-track { outline: 2px solid var(--accent); outline-offset: 2px; }

  .test-btn {
    font-family: var(--font-body); font-weight: var(--weight-light); font-size: var(--text-small);
    border: var(--border-width) solid var(--border); background: var(--surface);
    color: var(--text-primary); border-radius: 999px;
    padding: 0.5rem 0.85rem; cursor: pointer;
  }
  .test-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .test-btn.active { border-color: var(--accent); color: var(--accent); }
  input[type="range"].slider-demo {
    appearance: none; -webkit-appearance: none; width: 12rem; background: transparent; cursor: pointer;
  }
  input[type="range"].slider-demo::-webkit-slider-runnable-track {
    height: 2px; border-radius: 999px;
    background: linear-gradient(to right, var(--accent) 0 var(--fill, 50%), var(--border) var(--fill, 50%) 100%);
  }
  input[type="range"].slider-demo::-webkit-slider-thumb {
    -webkit-appearance: none; width: 0.625rem; height: 0.625rem; border-radius: 50%;
    background: var(--accent); margin-top: -0.25rem; cursor: pointer;
  }
  input[type="range"].slider-demo::-moz-range-track { height: 2px; border-radius: 999px; background: var(--border); }
  input[type="range"].slider-demo::-moz-range-progress { height: 2px; border-radius: 999px; background: var(--accent); }
  input[type="range"].slider-demo::-moz-range-thumb { width: 0.625rem; height: 0.625rem; border: none; border-radius: 50%; background: var(--accent); cursor: pointer; }

  .sliders { display: flex; flex-direction: column; gap: 0.5rem; }
  .slider-row {
    position: relative; height: 1.75rem; border-radius: var(--radius-sm);
    background: var(--waveform-bg); overflow: hidden;
  }
  .slider-row .fill { position: absolute; inset: 0; width: var(--fill, 0%); background: var(--border); pointer-events: none; }
  .slider-row .thumb {
    position: absolute; top: 0.3rem; bottom: 0.3rem; left: var(--fill, 0%); width: 2px;
    background: var(--accent); transform: translateX(-1px); pointer-events: none;
  }
  .slider-row .label {
    position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
    font-size: var(--text-small); font-weight: var(--weight-light); color: var(--text-secondary); pointer-events: none;
  }
  .slider-row .val {
    position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
    font-family: 'Roboto Mono', monospace; font-size: var(--text-small); font-weight: var(--weight-light);
    color: var(--text-primary); font-variant-numeric: tabular-nums; pointer-events: none;
  }
  .slider-row input[type="range"] { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .slider-row:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }

  .mute-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .mute-row button {
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-light);
    border: var(--border-width) solid var(--border); background: var(--surface);
    border-radius: 999px; padding: 0.3rem 0.7rem; cursor: pointer; color: var(--text-secondary);
  }

  .code-export {
    margin-top: 1.25rem; background: var(--page-bg); border: var(--border-width) solid var(--border);
    border-radius: var(--radius-md); padding: 0.85rem;
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-light); color: var(--text-primary);
    white-space: pre; overflow-x: auto;
  }
`;

// Grace period the frozen waveform stays on screen after its capture window completes,
// before the canvas clears to blank. Short — long enough to register as "still there for a
// beat," not long enough to read as a persistent scope trace.
const CAPTURE_CLEAR_DELAY_MS = 200;

// Fixed display window — not the whole gesture. Showing an entire 50-400ms gesture
// auto-zoomed to canvas width squeezes it into a compressed envelope burst; showing a
// short, fixed ~16ms slice centered on the loudest moment exposes the actual oscillation
// cycles, which is what makes a waveform panel readable as a *waveform* rather than a
// silhouette. Same window for every instance, short or long.
const DISPLAY_WINDOW_MS = 16;

// Target fraction of half-height the loudest sample in the displayed window should reach
// — auto-gain so quiet gestures (e.g. a 0.18 hover) aren't a flat line next to a loud one.
const TARGET_PEAK_FRACTION = 0.75;

// Raw (pre-gain) amplitude below which a sample counts as silence for drawing purposes —
// silent runs are skipped entirely (gap in the line) rather than traced as a flat segment.
const NOISE_FLOOR = 0.01;

// "Nice" tick intervals for the millisecond grid — smallest candidate that keeps the total
// tick count near `targetTicks` for whatever duration is being displayed.
function niceMsStep(totalMs: number, targetTicks = 7): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const raw = totalMs / targetTicks;
  return candidates.find((c) => c >= raw) ?? candidates[candidates.length - 1]!;
}

export class ChordalPlayground extends HTMLElement {
  private shadow: ShadowRoot;
  private family: SoundFamily = getFamily();
  private instance: SoundInstance = 'hover';
  private overrides = new Map<string, Partial<InstanceTuning>>();
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private idleTimer: number | null = null;
  private toggleState: 'on' | 'off' = 'off';

  // Trigger-scoped waveform capture — see drawWaveform()'s doc comment for why this
  // replaced a live rolling-analyser draw.
  private captureScratch: Float32Array | null = null;
  private captureBuffer: Float32Array | null = null;
  private captureWriteIndex = 0;
  private captureAudioMs = 0; // total buffered material: gesture length + a small tail
  private captureStartedAt = 0;
  private captureLastReadAt = 0;
  private captureActive = false;
  private captureFinishedAt: number | null = null;
  private captureSingleShot = false; // see startCapture()
  private analyserWindowMs = 0; // real time one full getFloatTimeDomainData read spans

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.setupWaveform();
  }

  disconnectedCallback(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private overrideKey(): string {
    return `${this.family}:${this.instance}`;
  }

  private currentTuning(): InstanceTuning {
    const base = PRESETS[this.family][this.instance];
    const override = this.overrides.get(this.overrideKey());
    return { ...base, ...override };
  }

  private setupWaveform(): void {
    const context = engine.getContext();
    const output = engine.getMasterGain();
    if (!context || !output) return; // SSR or Web Audio unavailable — no scope to draw

    this.analyser = context.createAnalyser();
    // Small window (~10.7ms at 48kHz) — see startCapture()'s doc comment for why: a forced
    // first read that's mostly pre-trigger silence used to waste a much larger fraction of
    // the whole buffer when the window was 4096.
    this.analyser.fftSize = 1024;
    output.connect(this.analyser);
    this.captureScratch = new Float32Array(this.analyser.frequencyBinCount);
    this.analyserWindowMs = (this.captureScratch.length / context.sampleRate) * 1000;
    this.drawWaveform();
  }

  /**
   * Starts a fresh capture for a gesture of `lengthSeconds` — buffers the gesture itself
   * plus a small tail (so a release transient isn't clipped). This is raw material for
   * drawWaveform()'s own fixed-size crop, not the display window itself.
   *
   * Two capture modes, chosen by how the gesture's length compares to one analyser window:
   * - captureSingleShot (gesture ≲ one window, covers most hovers): wait for the whole
   *   gesture to finish, then take exactly one read — the analyser's own rolling window by
   *   then naturally spans back far enough to contain the complete gesture already
   *   correctly positioned, no stitching needed.
   * - multi-read (everything longer — click/toggle/submit/etc): stitch several reads
   *   together, but gate the *first* one the same as every later one (wait a full
   *   analyserWindowMs before reading at all) instead of reading immediately at trigger
   *   time. A forced-immediate first read is almost entirely pre-trigger silence (the
   *   window looks backward from "now," and "now" is the instant the gesture just started),
   *   which used to burn a large fraction of a short gesture's whole buffer on nothing —
   *   observed as the real audio squeezed into a compressed sliver at one edge instead of
   *   centered.
   */
  private startCapture(lengthSeconds: number): void {
    const context = engine.getContext();
    if (!context || !this.analyser) return;
    const lengthMs = lengthSeconds * 1000;
    this.captureAudioMs = lengthMs + Math.max(5, lengthMs * 0.15);
    this.captureSingleShot = this.captureAudioMs <= this.analyserWindowMs;
    const totalSamples = Math.max(1, Math.ceil((this.captureAudioMs / 1000) * context.sampleRate));
    this.captureBuffer = new Float32Array(totalSamples);
    this.captureWriteIndex = 0;
    this.captureStartedAt = performance.now();
    this.captureLastReadAt = this.captureStartedAt;
    this.captureActive = true;
    this.captureFinishedAt = null;
  }

  // Faint vertical ticks only — no per-line text (the corner .status label already carries
  // the duration), and a dotted center reference line, matching a scope-style readout
  // rather than a labeled chart axis. Always spans DISPLAY_WINDOW_MS, not the gesture's own
  // length, since the plot itself is now a fixed-size crop.
  private drawGrid(ctx2d: CanvasRenderingContext2D, w: number, h: number): void {
    const step = niceMsStep(DISPLAY_WINDOW_MS, 8);
    ctx2d.strokeStyle = '#00000012';
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([]);
    for (let t = 0; t <= DISPLAY_WINDOW_MS + 0.001; t += step) {
      const x = (t / DISPLAY_WINDOW_MS) * w;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }
    ctx2d.strokeStyle = '#00000022';
    ctx2d.setLineDash([1, 3]);
    ctx2d.beginPath();
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  }

  /**
   * Not a live oscilloscope — a trigger-scoped capture, cropped and auto-gained for
   * readability. startCapture() buffers the gesture's own length plus a small tail; each
   * frame here pulls a fresh full read from the analyser once a whole analyserWindowMs has
   * genuinely elapsed (rather than estimating a partial sample count from wall-clock time,
   * which drifted against real audio time badly enough to read as near-total silence
   * followed by a compressed burst right at the capture's tail). Once buffered, the DRAWN
   * window is a fixed DISPLAY_WINDOW_MS slice centered on the loudest captured sample —
   * not the whole gesture — so individual oscillation cycles are visible instead of a
   * compressed envelope silhouette, and the interesting part always lands in the middle of
   * the panel regardless of exactly where capture timing placed it in the buffer. Idle (no
   * capture, or past its clear delay) is fully blank — no resting line, no grid.
   */
  private drawWaveform = (): void => {
    this.rafId = requestAnimationFrame(this.drawWaveform);
    const canvas = this.shadow.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || !this.analyser || !this.captureScratch) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();

    if (this.captureActive && this.captureBuffer) {
      if (this.captureSingleShot) {
        if (now - this.captureStartedAt >= this.captureAudioMs) {
          this.analyser.getFloatTimeDomainData(this.captureScratch as Float32Array<ArrayBuffer>);
          const toCopy = Math.min(this.captureScratch.length, this.captureBuffer.length);
          this.captureBuffer.set(this.captureScratch.subarray(this.captureScratch.length - toCopy), 0);
          this.captureWriteIndex = toCopy;
          this.captureActive = false;
          this.captureFinishedAt = now;
        }
      } else if (now - this.captureLastReadAt >= this.analyserWindowMs) {
        this.analyser.getFloatTimeDomainData(this.captureScratch as Float32Array<ArrayBuffer>);
        const remaining = this.captureBuffer.length - this.captureWriteIndex;
        const toCopy = Math.min(this.captureScratch.length, remaining);
        // A full read copies straight across; a final partial read (buffer almost full)
        // takes the newest tail of the window instead, so the freshest samples always win.
        const src = toCopy === this.captureScratch.length ? this.captureScratch : this.captureScratch.subarray(this.captureScratch.length - toCopy);
        this.captureBuffer.set(src, this.captureWriteIndex);
        this.captureWriteIndex += toCopy;
        this.captureLastReadAt = now;
        if (this.captureWriteIndex >= this.captureBuffer.length) {
          this.captureActive = false;
          this.captureFinishedAt = now;
        }
      }
    }

    const withinClearDelay = this.captureFinishedAt !== null && now - this.captureFinishedAt < CAPTURE_CLEAR_DELAY_MS;
    const showingCapture = this.captureBuffer !== null && (this.captureActive || withinClearDelay);

    ctx2d.clearRect(0, 0, w, h);
    if (!showingCapture) {
      if (this.captureBuffer !== null && this.captureFinishedAt !== null && !withinClearDelay) {
        this.captureBuffer = null; // fully done — stop re-checking every frame
      }
      return; // idle: blank canvas, no curve, no grid
    }

    const buf = this.captureBuffer!;
    const n = this.captureWriteIndex;
    if (n < 2) {
      this.drawGrid(ctx2d, w, h);
      return;
    }

    const context = engine.getContext();
    const sampleRate = context?.sampleRate ?? 48000;
    const cropSamples = Math.max(2, Math.round((DISPLAY_WINDOW_MS / 1000) * sampleRate));

    // Find the loudest sample captured so far — that's what gets centered.
    let peakIndex = 0;
    let peakVal = 0;
    for (let i = 0; i < n; i++) {
      const v = buf[i] ?? 0;
      if (Math.abs(v) > Math.abs(peakVal)) {
        peakVal = v;
        peakIndex = i;
      }
    }

    let cropStart: number;
    let cropLen: number;
    if (n <= cropSamples) {
      cropStart = 0;
      cropLen = n;
    } else {
      cropStart = Math.min(Math.max(peakIndex - Math.floor(cropSamples / 2), 0), n - cropSamples);
      cropLen = cropSamples;
    }
    // Center shorter captures (e.g. an 8ms hover) inside the fixed display window instead
    // of stretching them to fill it — same physical time-per-pixel scale as a full crop.
    const leadBlankPx = ((cropSamples - cropLen) / 2 / cropSamples) * w;

    this.drawGrid(ctx2d, w, h);

    const gain = peakVal !== 0 ? (TARGET_PEAK_FRACTION * (h / 2)) / Math.abs(peakVal) : 1;

    // One point per pixel column, not one per sample — plotting every raw sample would be
    // fine at this zoom level (samples-per-pixel is low with only ~16ms across the canvas)
    // but the peak-preserving decimation keeps a fast transient's true peak from being
    // averaged away, then quadratic curves between points give smooth, rounded humps
    // instead of a jagged straight-segment trace. Raw (pre-gain) peak is kept alongside y
    // so silent columns can be skipped below rather than traced as a flat line.
    const points: Array<{ x: number; y: number; peak: number }> = [];
    const samplesPerCol = cropLen / (w - leadBlankPx * 2 || 1);
    for (let px = 0; px <= w - leadBlankPx * 2; px++) {
      const start = Math.floor(px * samplesPerCol);
      const end = Math.min(cropLen, Math.max(start + 1, Math.floor((px + 1) * samplesPerCol)));
      let peak = 0;
      for (let i = start; i < end; i++) {
        const v = buf[cropStart + i] ?? 0;
        if (Math.abs(v) > Math.abs(peak)) peak = v;
      }
      points.push({ x: leadBlankPx + px, y: h / 2 - peak * gain, peak });
    }

    // Draw only where the signal actually clears the noise floor — but with hold/hysteresis,
    // not a bare per-column check: a broadband noise waveform (paper-snap) legitimately
    // crosses back near zero between almost every peak while still fully "active," so a
    // bare per-column gap fragmented it into dozens of disconnected slivers instead of one
    // continuous trace. Holding the line through any single short quiet stretch (a handful
    // of columns, ~1ms) bridges those crossings while still treating a genuinely sustained
    // silence (padding before/after the real gesture) as a real gap.
    const holdColumns = Math.max(3, Math.round((w / DISPLAY_WINDOW_MS) * 1));
    ctx2d.strokeStyle = FAMILY_ACCENTS[this.family];
    ctx2d.lineWidth = 1;
    ctx2d.lineJoin = 'round';
    ctx2d.lineCap = 'round';
    let drawing = false;
    let silentRun = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const active = Math.abs(p.peak) > NOISE_FLOOR;
      silentRun = active ? 0 : silentRun + 1;
      const shouldDraw = active || (drawing && silentRun <= holdColumns);
      if (!shouldDraw) {
        if (drawing) {
          ctx2d.stroke();
          drawing = false;
        }
        continue;
      }
      if (!drawing) {
        ctx2d.beginPath();
        ctx2d.moveTo(p.x, p.y);
        drawing = true;
        continue;
      }
      const next = points[i + 1];
      const nextShouldDraw = next && (Math.abs(next.peak) > NOISE_FLOOR || silentRun < holdColumns);
      if (nextShouldDraw) {
        const mid = { x: (p.x + next!.x) / 2, y: (p.y + next!.y) / 2 };
        ctx2d.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
      } else {
        ctx2d.lineTo(p.x, p.y);
      }
    }
    if (drawing) ctx2d.stroke();

    this.updateFrequencyLabel(buf, cropStart, cropLen, sampleRate);
  };

  // Zero-crossing rate over the displayed crop — a cheap, good-enough dominant-frequency
  // estimate for the mostly-monotone transients this library produces, not a real FFT.
  private updateFrequencyLabel(buf: Float32Array, start: number, len: number, sampleRate: number): void {
    if (len < 4) return;
    let crossings = 0;
    let prev = buf[start] ?? 0;
    for (let i = 1; i < len; i++) {
      const v = buf[start + i] ?? 0;
      if ((prev >= 0) !== (v >= 0)) crossings++;
      prev = v;
    }
    const hz = (crossings / 2 / (len / sampleRate)) || 0;
    const status = this.shadow.querySelector<HTMLElement>('.status');
    if (!status) return;
    const freqLabel = hz >= 50 ? `${(hz / 1000).toFixed(1)} kHz, ` : '';
    const durationLabel = `${(this.captureAudioMs / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0')} s`;
    status.textContent = `${this.family} · ${this.instance} · ${freqLabel}${durationLabel}`;
  }

  private showStatus(instance: SoundInstance, tuning: InstanceTuning): void {
    this.startCapture(tuning.length);
    const status = this.shadow.querySelector<HTMLElement>('.status');
    if (!status) return;
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    status.textContent = `${this.family} · ${instance} · ${Math.round(tuning.length * 1000)}ms`;
    this.idleTimer = window.setTimeout(() => {
      status.textContent = 'idle';
    }, tuning.length * 1000 + 200);
  }

  private triggerTest(instance: SoundInstance, options: { state?: 'on' | 'off' } = {}): void {
    this.setActiveInstance(instance);
    const key = `${this.family}:${instance}`;
    const override = this.overrides.get(key) ?? {};
    play(instance, { family: this.family, ...override, ...options });
    this.showStatus(instance, { ...PRESETS[this.family][instance], ...override });
  }

  private buildSnippet(): string {
    const tuning = this.currentTuning();
    return [
      "import { play } from 'chordal';",
      '',
      `play('${this.instance}', {`,
      `  family: '${this.family}',`,
      `  volume: ${tuning.volume.toFixed(2)},`,
      `  pitch: ${tuning.pitch.toFixed(2)},`,
      `  length: ${tuning.length.toFixed(3)},`,
      `  tone: ${tuning.tone.toFixed(2)},`,
      '});',
    ].join('\n');
  }

  private refreshCodeExport(): void {
    const el = this.shadow.querySelector('.code-export');
    if (el) el.textContent = this.buildSnippet();
  }

  private refreshSliders(): void {
    const tuning = this.currentTuning();
    SLIDER_SPECS.forEach((spec) => {
      const input = this.shadow.querySelector<HTMLInputElement>(`input[data-key="${spec.key}"]`);
      const val = this.shadow.querySelector<HTMLElement>(`.val[data-key="${spec.key}"]`);
      const value = tuning[spec.key];
      if (input) input.value = String(value);
      if (val) val.textContent = spec.format(value, FAMILY_RECIPES[this.family].baseFrequency);
      this.setSliderFill(spec, value);
    });
  }

  private setSliderFill(spec: (typeof SLIDER_SPECS)[number], value: number): void {
    const row = this.shadow.querySelector<HTMLElement>(`input[data-key="${spec.key}"]`)?.closest('.slider-row');
    if (!row) return;
    const pct = ((value - spec.min) / (spec.max - spec.min)) * 100;
    (row as HTMLElement).style.setProperty('--fill', `${pct}%`);
  }

  private selectFamily(family: SoundFamily): void {
    this.family = family;
    setFamily(family);
    this.style.setProperty('--accent', FAMILY_ACCENTS[family]);
    this.shadow.querySelectorAll<HTMLElement>('.family-btn').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.family === family));
    });
    this.refreshSliders();
    this.refreshCodeExport();
    // Preview the family immediately using whatever instance is currently selected —
    // don't force it back to hover, or switching families would silently discard the
    // user's instance selection every time.
    this.triggerTest(this.instance);
  }

  /**
   * Test elements double as the instance selector — triggering one both plays it and
   * makes it what the Inspector's sliders are tuning. No separate Instance section.
   */
  private setActiveInstance(instance: SoundInstance): void {
    this.instance = instance;
    this.shadow.querySelectorAll<HTMLElement>('[data-instance-trigger]').forEach((el) => {
      el.classList.toggle('active', el.dataset.instanceTrigger === instance);
    });
    this.refreshSliders();
    this.refreshCodeExport();
  }

  private render(): void {
    const familyListHtml = SOUND_FAMILIES.map(
      (f) =>
        `<button type="button" class="family-btn" data-family="${f}" aria-pressed="${f === this.family}" style="--dot:${FAMILY_ACCENTS[f]}"><span class="dot"></span>${f}</button>`
    ).join('');

    const slidersHtml = SLIDER_SPECS.map(
      (spec) => `
      <div class="slider-row" style="--fill:0%">
        <input type="range" data-key="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" />
        <div class="fill"></div>
        <div class="thumb"></div>
        <span class="label">${spec.label}</span>
        <span class="val" data-key="${spec.key}"></span>
      </div>`
    ).join('');

    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="studio">
        <div class="pane">
          <div class="pane-head">Family</div>
          <div class="family-list">${familyListHtml}</div>
          <div class="mute-row">
            <button type="button" class="mute-btn">${isMuted() ? 'Unmute' : 'Mute'}</button>
          </div>
        </div>
        <div class="pane">
          <div class="pane-head">Waveform</div>
          <div class="waveform-wrap">
            <canvas width="640" height="144"></canvas>
            <div class="status">idle</div>
          </div>
          <div class="test-area">
            <div class="instance-group-label">Instance</div>
            <div class="instance-group">
              <div class="instance-pills">
                <button type="button" class="test-btn" data-test="hover" data-instance-trigger="hover">Hover</button>
                <button type="button" class="test-btn" data-test="click" data-instance-trigger="click">Click</button>
                <button type="button" class="test-btn" data-test="congrats" data-instance-trigger="congrats">Success</button>
                <button type="button" class="test-btn" data-test="submit" data-instance-trigger="submit">Sent</button>
                <button type="button" class="test-btn" data-test="error" data-instance-trigger="error">Error</button>
                <button type="button" class="test-btn" data-test="notification" data-instance-trigger="notification">Notification</button>
              </div>
              <div class="instance-divider"></div>
              <div class="instance-ctrl-row">
                <span class="instance-ctrl-label">Toggle switch</span>
                <label class="switch">
                  <input type="checkbox" data-test="toggle" />
                  <span class="switch-track"><span class="switch-knob"></span></span>
                </label>
              </div>
              <div class="instance-ctrl-row">
                <span class="instance-ctrl-label">Slider</span>
                <input type="range" class="slider-demo" min="0" max="100" value="50" data-test="slider" />
              </div>
            </div>
          </div>
          <div class="code-export"></div>
        </div>
        <div class="pane">
          <div class="pane-head">Inspector</div>
          <div class="sliders">${slidersHtml}</div>
        </div>
      </div>
    `;

    this.wireEvents();
    this.style.setProperty('--accent', FAMILY_ACCENTS[this.family]);
    this.setActiveInstance(this.instance);
  }

  private wireEvents(): void {
    this.shadow.querySelectorAll<HTMLElement>('.family-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.selectFamily(btn.dataset.family as SoundFamily));
    });

    SLIDER_SPECS.forEach((spec) => {
      const input = this.shadow.querySelector<HTMLInputElement>(`input[data-key="${spec.key}"]`);
      input?.addEventListener('input', () => {
        const value = Number(input.value);
        const key = this.overrideKey();
        const current = this.overrides.get(key) ?? {};
        this.overrides.set(key, { ...current, [spec.key]: value });
        const val = this.shadow.querySelector<HTMLElement>(`.val[data-key="${spec.key}"]`);
        if (val) val.textContent = spec.format(value, FAMILY_RECIPES[this.family].baseFrequency);
        this.setSliderFill(spec, value);
        this.refreshCodeExport();
        this.triggerTest(this.instance);
      });
    });

    const hoverBtn = this.shadow.querySelector<HTMLElement>('[data-test="hover"]');
    hoverBtn?.addEventListener('pointerenter', () => this.triggerTest('hover'));

    const clickBtn = this.shadow.querySelector<HTMLElement>('[data-test="click"]');
    clickBtn?.addEventListener('pointerdown', () => this.triggerTest('click'));

    const congratsBtn = this.shadow.querySelector<HTMLElement>('[data-test="congrats"]');
    congratsBtn?.addEventListener('click', () => this.triggerTest('congrats'));

    const toggleInput = this.shadow.querySelector<HTMLInputElement>('[data-test="toggle"]');
    toggleInput?.addEventListener('change', () => {
      this.toggleState = toggleInput.checked ? 'on' : 'off';
      this.triggerTest('toggle', { state: this.toggleState });
    });

    const errorBtn = this.shadow.querySelector<HTMLElement>('[data-test="error"]');
    errorBtn?.addEventListener('click', () => this.triggerTest('error'));

    const submitBtn = this.shadow.querySelector<HTMLElement>('[data-test="submit"]');
    submitBtn?.addEventListener('click', () => this.triggerTest('submit'));

    const notificationBtn = this.shadow.querySelector<HTMLElement>('[data-test="notification"]');
    notificationBtn?.addEventListener('click', () => this.triggerTest('notification'));

    const sliderDemo = this.shadow.querySelector<HTMLInputElement>('[data-test="slider"]');
    sliderDemo?.style.setProperty('--fill', `${sliderDemo.value}%`);
    sliderDemo?.addEventListener('input', () => {
      const ratio = Number(sliderDemo.value) / 100;
      sliderDemo.style.setProperty('--fill', `${sliderDemo.value}%`);
      playContinuous('slider', ratio, { family: this.family });
      // playContinuous's own tick length isn't exposed here — 30ms is a reasonable
      // estimate for its body+click layers, close enough for the capture window to catch
      // the tick without needing the exact internal duration plumbed through.
      this.startCapture(0.03);
      const status = this.shadow.querySelector<HTMLElement>('.status');
      if (status) status.textContent = `${this.family} · slider · ${ratio.toFixed(2)}`;
    });

    const muteBtn = this.shadow.querySelector<HTMLElement>('.mute-btn');
    muteBtn?.addEventListener('click', () => {
      if (isMuted()) {
        unmute();
        muteBtn.textContent = 'Mute';
      } else {
        mute();
        muteBtn.textContent = 'Unmute';
      }
    });
  }
}

if (!customElements.get('chordal-playground')) {
  customElements.define('chordal-playground', ChordalPlayground);
}
