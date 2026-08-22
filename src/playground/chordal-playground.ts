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

// Extra time to keep drawing live past a gesture's own nominal length — covers a natural
// decay/shimmer tail the engine may still be rendering after the "note" technically ends.
const ACTIVE_GRACE_MS = 120;

// Minimum time between actual redraws. Redrawing every rAF tick (~60/sec) from a fast-
// moving ~10.7ms rolling window reads as flicker, not a readable trace. This is deliberately
// slow for readability — sampling for content (see peakHold* fields) runs every rAF tick
// regardless, so a brief transient between two redraws still gets caught and shown at the
// next one instead of being missed the way a naively-throttled "read only at redraw time"
// approach would miss it.
const DRAW_INTERVAL_MS = 80;

// Target fraction of half-height the loudest sample in the current live window should
// reach — auto-gain recomputed every frame, so it tracks the signal's own envelope (loud
// attack, quiet decay) as it plays, not a single value fixed at trigger time.
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

  // Live waveform — see drawWaveform()'s doc comment.
  private liveScratch: Float32Array | null = null; // per-rAF read target
  private peakHoldScratch: Float32Array | null = null; // loudest window seen since last redraw
  private peakHoldValue = 0;
  private sampleRate = 48000;
  private analyserWindowMs = 0; // real time one getFloatTimeDomainData read spans — the
  // live display window itself, not a separate crop
  private activeUntil = 0; // performance.now() timestamp; blank canvas once passed
  private gestureLengthMs = 0; // last-triggered instance's own length, for the status label
  private lastDrawAt = 0; // throttles actual redraws — see DRAW_INTERVAL_MS

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
    // fftSize 1024 -> 512-sample window, ~10.7ms at 48kHz. This is the live display window
    // itself now (not a source buffer for a separate crop) — small enough to expose
    // individual oscillation cycles rather than a compressed envelope.
    this.analyser.fftSize = 1024;
    output.connect(this.analyser);
    this.sampleRate = context.sampleRate;
    this.liveScratch = new Float32Array(this.analyser.frequencyBinCount);
    this.peakHoldScratch = new Float32Array(this.analyser.frequencyBinCount);
    this.analyserWindowMs = (this.liveScratch.length / this.sampleRate) * 1000;
    this.drawWaveform();
  }

  /** Marks the panel active for a gesture of `lengthSeconds` — drawWaveform() draws the
   *  analyser live every frame until this window (length + a decay-tail grace) elapses. */
  private markActive(lengthSeconds: number): void {
    this.gestureLengthMs = lengthSeconds * 1000;
    this.activeUntil = performance.now() + this.gestureLengthMs + ACTIVE_GRACE_MS;
  }

  // Faint vertical ticks only — no per-line text (the corner .status label already carries
  // the duration), and a dotted center reference line, matching a scope-style readout
  // rather than a labeled chart axis. Spans the analyser's own live window.
  private drawGrid(ctx2d: CanvasRenderingContext2D, w: number, h: number): void {
    const step = niceMsStep(this.analyserWindowMs, 8);
    ctx2d.strokeStyle = '#00000012';
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([]);
    for (let t = 0; t <= this.analyserWindowMs + 0.001; t += step) {
      const x = (t / this.analyserWindowMs) * w;
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
   * Genuinely live: no capture buffer, no freeze, no crop — but sampling and redrawing run
   * at two different rates. Every single rAF tick reads the analyser's short rolling window
   * (~10.7ms, see setupWaveform) and keeps whichever one seen so far this interval had the
   * largest peak (peakHold*) — cheap, and it means a brief transient (a knock, a few ms
   * wide) landing between two redraws still gets caught rather than silently missed. Actual
   * redraws only happen every DRAW_INTERVAL_MS, using that held peak window — redrawing
   * every tick reads as flicker (the window slides and gain recomputes faster than the eye
   * can track), so the two concerns (catch brief content / stay readable) are handled by
   * separate rates instead of trading off against each other on a single throttle value.
   * Idle (nothing triggered within markActive's window) is fully blank — no line, no grid.
   */
  private drawWaveform = (): void => {
    this.rafId = requestAnimationFrame(this.drawWaveform);
    const canvas = this.shadow.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || !this.analyser || !this.liveScratch || !this.peakHoldScratch) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();

    if (now >= this.activeUntil) {
      ctx2d.clearRect(0, 0, w, h); // idle: blank canvas, no curve, no grid — clears promptly,
      this.peakHoldValue = 0; // not throttled, so it never lingers after a gesture ends
      return;
    }

    // Sample every tick regardless of redraw throttling — see doc comment above.
    this.analyser.getFloatTimeDomainData(this.liveScratch as Float32Array<ArrayBuffer>);
    let framePeak = 0;
    for (let i = 0; i < this.liveScratch.length; i++) {
      const v = this.liveScratch[i] ?? 0;
      if (Math.abs(v) > Math.abs(framePeak)) framePeak = v;
    }
    if (Math.abs(framePeak) > Math.abs(this.peakHoldValue)) {
      this.peakHoldValue = framePeak;
      this.peakHoldScratch.set(this.liveScratch);
    }

    // Throttled to DRAW_INTERVAL_MS, not every rAF tick — leaves the previous frame on
    // screen in between instead of clearing (which would flicker to blank every skipped
    // tick) so each redraw actually gets enough time to register before the next one.
    if (now - this.lastDrawAt < DRAW_INTERVAL_MS) return;
    this.lastDrawAt = now;

    const buf = this.peakHoldScratch;
    const peakVal = this.peakHoldValue;
    this.peakHoldValue = 0; // reset the hold for the next interval

    ctx2d.clearRect(0, 0, w, h);
    this.drawGrid(ctx2d, w, h);
    this.updateFrequencyLabel(buf);

    if (Math.abs(peakVal) <= NOISE_FLOOR) return; // nothing audible this interval — grid only

    // Trigger-align to the onset: find where the signal first clears the noise floor and
    // draw from *there* to the end of the window, not from raw sample 0. Without this, the
    // held window's onset can land anywhere inside it depending on exactly when that rAF
    // tick happened to sample — a short transient starting partway through reads as the
    // trace starting mid-canvas instead of consistently from the left edge.
    let onsetIndex = 0;
    for (let i = 0; i < buf.length; i++) {
      if (Math.abs(buf[i] ?? 0) > NOISE_FLOOR) {
        onsetIndex = i;
        break;
      }
    }
    const segment = buf.subarray(onsetIndex);
    const n = segment.length;

    const gain = (TARGET_PEAK_FRACTION * (h / 2)) / Math.abs(peakVal);

    // One point per pixel column, not one per sample — the peak-preserving decimation keeps
    // a fast transient's true peak from being averaged away, then quadratic curves between
    // points give smooth, rounded humps instead of a jagged straight-segment trace. Raw
    // (pre-gain) peak is kept alongside y so silent columns can be skipped below.
    const points: Array<{ x: number; y: number; peak: number }> = [];
    const samplesPerCol = n / w;
    for (let px = 0; px < w; px++) {
      const start = Math.floor(px * samplesPerCol);
      const end = Math.min(n, Math.max(start + 1, Math.floor((px + 1) * samplesPerCol)));
      let peak = 0;
      for (let i = start; i < end; i++) {
        const v = segment[i] ?? 0;
        if (Math.abs(v) > Math.abs(peak)) peak = v;
      }
      points.push({ x: px, y: h / 2 - peak * gain, peak });
    }

    // Draw only where the signal actually clears the noise floor — but with hold/hysteresis,
    // not a bare per-column check: a broadband noise waveform (paper-snap) legitimately
    // crosses back near zero between almost every peak while still fully "active," so a
    // bare per-column gap fragmented it into dozens of disconnected slivers instead of one
    // continuous trace. Holding the line through any single short quiet stretch (a handful
    // of columns, ~1ms) bridges those crossings while still treating a genuinely sustained
    // silence as a real gap.
    const holdColumns = Math.max(3, Math.round(w / this.analyserWindowMs));
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
  };

  // Zero-crossing rate over the current live window — a cheap, good-enough dominant-
  // frequency estimate for the mostly-monotone transients this library produces, not a
  // real FFT. Duration shown is the triggered gesture's own nominal length, not the tiny
  // live window itself.
  private updateFrequencyLabel(buf: Float32Array): void {
    let crossings = 0;
    let prev = buf[0] ?? 0;
    for (let i = 1; i < buf.length; i++) {
      const v = buf[i] ?? 0;
      if ((prev >= 0) !== (v >= 0)) crossings++;
      prev = v;
    }
    const hz = (crossings / 2 / (buf.length / this.sampleRate)) || 0;
    const status = this.shadow.querySelector<HTMLElement>('.status');
    if (!status) return;
    const freqLabel = hz >= 50 ? `${(hz / 1000).toFixed(1)} kHz, ` : '';
    const durationLabel = `${(this.gestureLengthMs / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0')} s`;
    status.textContent = `${this.family} · ${this.instance} · ${freqLabel}${durationLabel}`;
  }

  private showStatus(instance: SoundInstance, tuning: InstanceTuning): void {
    this.markActive(tuning.length);
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
      // estimate for its body+click layers, close enough to keep the panel live for the
      // tick without needing the exact internal duration plumbed through.
      this.markActive(0.03);
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
