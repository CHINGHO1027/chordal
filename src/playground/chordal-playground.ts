/**
 * <chordal-playground> — framework-agnostic Web Component. Family/instance selectors,
 * 4 live tuning sliders, a test area covering all 5 instances, a live oscilloscope,
 * and a copy-pasteable code snippet. Not part of the core bundle's 5KB budget.
 */

import * as engine from '../engine';
import { play, playContinuous, setFamily, getFamily, mute, unmute, isMuted, SOUND_FAMILIES } from '../index';
import { PRESETS, type InstanceTuning } from '../presets';
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

const SLIDER_SPECS: Array<{ key: keyof InstanceTuning; label: string; min: number; max: number; step: number; format: (v: number) => string }> = [
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'pitch', label: 'Pitch', min: 0.5, max: 2, step: 0.01, format: (v) => `${v.toFixed(2)}×` },
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

    /* type tokens — three sizes, weight tops out at 500 and only pane titles use it */
    --text-heading: 0.8125rem;
    --text-body: 0.75rem;
    --text-small: 0.6875rem;
    --weight-regular: 400;
    --weight-medium: 500;

    display: block;
    max-width: 60rem;
    margin: 0 auto;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-weight: var(--weight-regular);
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
    font-weight: var(--weight-medium);
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }
  .family-list { display: flex; flex-direction: column; gap: 0.3rem; }
  .family-btn {
    display: flex; align-items: center; gap: 0.55rem;
    font-family: var(--font-body); font-size: var(--text-body); font-weight: var(--weight-regular);
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
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-regular);
    color: var(--accent); font-variant-numeric: tabular-nums;
  }

  .test-area { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1rem; }
  .test-btn {
    font-family: var(--font-body); font-weight: var(--weight-regular); font-size: var(--text-small);
    border: var(--border-width) solid var(--border); background: var(--page-bg);
    color: var(--text-primary); border-radius: var(--radius-sm);
    padding: 0.55rem 0.9rem; cursor: pointer;
  }
  .test-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .test-btn.active { border-color: var(--accent); color: var(--accent); }
  input[type="range"].slider-demo { width: 12rem; accent-color: var(--accent); }

  .sliders { display: flex; flex-direction: column; gap: 1rem; }
  .slider-row .top { display: flex; justify-content: space-between; font-size: var(--text-body); margin-bottom: 0.3rem; }
  .slider-row .top .label { font-weight: var(--weight-regular); }
  .slider-row .top .val { font-family: var(--font-body); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .slider-row input[type="range"] { width: 100%; accent-color: var(--accent); }

  .mute-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .mute-row button {
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-regular);
    border: var(--border-width) solid var(--border); background: var(--surface);
    border-radius: 999px; padding: 0.3rem 0.7rem; cursor: pointer; color: var(--text-secondary);
  }

  .code-export {
    margin-top: 1.25rem; background: var(--page-bg); border: var(--border-width) solid var(--border);
    border-radius: var(--radius-md); padding: 0.85rem;
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-regular); color: var(--text-primary);
    white-space: pre; overflow-x: auto;
  }
`;

export class ChordalPlayground extends HTMLElement {
  private shadow: ShadowRoot;
  private family: SoundFamily = getFamily();
  private instance: SoundInstance = 'hover';
  private overrides = new Map<string, Partial<InstanceTuning>>();
  private analyser: AnalyserNode | null = null;
  private waveData: Uint8Array | null = null;
  private rafId: number | null = null;
  private idleTimer: number | null = null;
  private toggleState: 'on' | 'off' = 'off';

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
    this.analyser.fftSize = 1024;
    output.connect(this.analyser);
    this.waveData = new Uint8Array(this.analyser.frequencyBinCount);
    this.drawWaveform();
  }

  private drawWaveform = (): void => {
    this.rafId = requestAnimationFrame(this.drawWaveform);
    const canvas = this.shadow.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || !this.analyser || !this.waveData) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = canvas.width;
    const h = canvas.height;
    this.analyser.getByteTimeDomainData(this.waveData as Uint8Array<ArrayBuffer>);

    ctx2d.clearRect(0, 0, w, h);
    ctx2d.strokeStyle = '#00000014';
    ctx2d.beginPath();
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();

    ctx2d.beginPath();
    const slice = w / this.waveData.length;
    let x = 0;
    for (let i = 0; i < this.waveData.length; i++) {
      const v = (this.waveData[i] ?? 128) / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += slice;
    }
    ctx2d.strokeStyle = FAMILY_ACCENTS[this.family];
    ctx2d.lineWidth = 1.5;
    ctx2d.stroke();
  };

  private showStatus(instance: SoundInstance, tuning: InstanceTuning): void {
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
      if (val) val.textContent = spec.format(value);
    });
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
    // Preview the family immediately — hover is the shortest, least intrusive instance,
    // so browsing families doesn't require moving to the test area to hear each one.
    this.triggerTest('hover');
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
      <div class="slider-row">
        <div class="top"><span class="label">${spec.label}</span><span class="val" data-key="${spec.key}"></span></div>
        <input type="range" data-key="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" />
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
            <button type="button" class="test-btn" data-test="hover" data-instance-trigger="hover">Hover card</button>
            <button type="button" class="test-btn" data-test="press" data-instance-trigger="press">Press</button>
            <button type="button" class="test-btn" data-test="congrats" data-instance-trigger="congrats">Complete task</button>
            <button type="button" class="test-btn" data-test="toggle" data-instance-trigger="toggle" aria-pressed="false">Toggle switch</button>
            <button type="button" class="test-btn" data-test="error" data-instance-trigger="error">Submit</button>
            <input type="range" class="slider-demo" min="0" max="100" value="50" data-test="slider" />
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
        if (val) val.textContent = spec.format(value);
        this.refreshCodeExport();
        this.triggerTest(this.instance);
      });
    });

    const hoverBtn = this.shadow.querySelector<HTMLElement>('[data-test="hover"]');
    hoverBtn?.addEventListener('pointerenter', () => this.triggerTest('hover'));

    const pressBtn = this.shadow.querySelector<HTMLElement>('[data-test="press"]');
    pressBtn?.addEventListener('pointerdown', () => this.triggerTest('press'));

    const congratsBtn = this.shadow.querySelector<HTMLElement>('[data-test="congrats"]');
    congratsBtn?.addEventListener('click', () => this.triggerTest('congrats'));

    const toggleBtn = this.shadow.querySelector<HTMLElement>('[data-test="toggle"]');
    toggleBtn?.addEventListener('click', () => {
      this.toggleState = this.toggleState === 'on' ? 'off' : 'on';
      toggleBtn.setAttribute('aria-pressed', String(this.toggleState === 'on'));
      this.triggerTest('toggle', { state: this.toggleState });
    });

    const errorBtn = this.shadow.querySelector<HTMLElement>('[data-test="error"]');
    errorBtn?.addEventListener('click', () => this.triggerTest('error'));

    const sliderDemo = this.shadow.querySelector<HTMLInputElement>('[data-test="slider"]');
    sliderDemo?.addEventListener('input', () => {
      const ratio = Number(sliderDemo.value) / 100;
      playContinuous('slider', ratio, { family: this.family });
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
