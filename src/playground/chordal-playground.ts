/**
 * <chordal-playground> — framework-agnostic Web Component. Family/instance selectors,
 * 4 live tuning sliders, a test area covering all 5 instances, a live oscilloscope,
 * and a copy-pasteable code snippet. Not part of the core bundle's 5KB budget.
 */

import { play, playContinuous, setFamily, getFamily, SOUND_FAMILIES } from '../index';
import { PRESETS, FAMILY_RECIPES, isToneAudible, type InstancePreset, type InstanceTuning, type Note } from '../presets';
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
    /* Same alias as tokens.css's own --tint: var(--border) — declared locally here too,
       not left to inherit across the shadow boundary from the page's tokens.css, since
       every other token in this block is already a local, self-contained copy for exactly
       that reason (this component works even embedded somewhere without tokens.css). It
       happened to keep working via inheritance when this was first added since the site's
       own --tint resolves to the same value anyway, but that was luck, not the pattern. */
    --tint: var(--border);
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
    button { transition: none !important; }
  }

  .studio {
    display: grid;
    grid-template-columns: 13rem 1fr 16rem;
    gap: var(--border-width);
    /* Below 44rem, the two fixed columns (13rem + 16rem = 29rem) alone leave too
       little room for the flexible middle column to be usable — stack all three
       panes full-width instead, in the same DOM order (Family, Waveform,
       Inspector), which already reads fine top to bottom: pick a family, watch
       it/trigger it, then tune it. A viewport media query, not a container
       query — this component is only ever embedded full-width in practice (see
       index.html's .explorer), so viewport width is a fair proxy here. */
    /* Solid, not the translucent/blurred glass this used to be — reads as one
       consistent opaque surface, same as every .card elsewhere on the site,
       rather than a frame that shifts with whatever's behind it. var(--tint)
       shows only as the thin gap line between panes (see gap above); .pane's
       own background below is what actually reads as the panel's surface. */
    background: var(--tint);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 24px 48px -24px rgba(23, 17, 12, 0.28), 0 2px 8px rgba(23, 17, 12, 0.06);
  }
  @media (max-width: 44rem) {
    .studio { grid-template-columns: 1fr; }
  }
  .pane {
    /* Solid var(--surface), not a translucent/blurred glass pane over the hero
       image — reads as one stable opaque surface regardless of what's behind
       it, same as .studio's own background above. */
    background: var(--surface);
    padding: 1rem;
    /* min-width:0 overrides this grid item's own default automatic minimum
       size (based on its content's intrinsic width, not 0) — without it, at
       narrow widths .family-list's own unbreakable button text (see
       .family-btn's own min-width:0 below) forces this pane wider than
       .studio's single 1fr track. .studio's own overflow:hidden then clips
       the excess rather than showing a page scrollbar, so this bug read as
       content silently cut off inside the rounded panel edge, not as an
       obvious horizontal-scroll bug. Confirmed via a real 375px-viewport
       test (an iframe, which gets its own independent CSS viewport) — the
       Family pane was rendering 363px wide inside a 314px .studio before
       this fix. */
    min-width: 0;
  }
  .pane-head {
    font-family: var(--font-body);
    font-size: var(--text-heading);
    font-weight: var(--weight-regular);
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }
  .family-list { display: flex; flex-direction: column; gap: 0.3rem; }
  /* Placed after the base rule above (not inside the earlier .studio media
     block) — same selector/specificity, so the later rule in source order
     wins; putting a same-specificity override before its own base rule is
     exactly the bug that silently reverted .site-nav's position earlier in
     this project (see index.html's own .hero-band comment) and it bit
     this rule the same way: display:grid never actually took effect, only
     grid-template-columns did (a property the base rule never touches), so
     the list looked identical to the unstyled flex-column default despite
     the media query genuinely matching. The Family pane goes from a narrow
     13rem column to the full panel width once .studio stacks — a single
     vertical list of 9 buttons no longer makes good use of that width, so
     it becomes a 2-column grid instead. */
  @media (max-width: 44rem) {
    .family-list { display: grid; grid-template-columns: repeat(2, 1fr); }
  }
  .family-btn {
    display: flex; align-items: center; gap: 0.55rem;
    font-family: var(--font-body); font-size: var(--text-body); font-weight: var(--weight-light);
    text-align: left; border: none; background: none; cursor: pointer;
    padding: 0.4rem 0.5rem; border-radius: var(--radius-sm);
    color: var(--text-secondary);
    /* The actual source of the blowout .pane's own min-width:0 comment
       describes: a family name like "glass-crystal" is one unbreakable
       token (no space to wrap at), so as a grid item of .family-list's
       2-column grid, this button's own default automatic minimum size
       resists shrinking below that text's full width — which, multiplied
       across a whole column, can force the grid wider than its container
       even though the text actually fits fine once a track is properly
       sized to 1fr (confirmed empirically: no truncation needed once this
       is in place). */
    min-width: 0;
  }
  .family-btn .dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--dot); flex-shrink: 0; }
  /* A weaker version of the selected row's own var(--page-bg) fill, not a different
     color — reusing the selected row's own color (just weaker) makes hover read as
     "part-way to selected" rather than an unrelated third color. (var(--tint) was
     tried first, back when this pane's own backdrop was a translucent tan glass —
     see .pane above, now solid var(--surface) — and read as too low-contrast against
     it. Worth a fresh look now that the backdrop is plain white instead of tan.) */
  .family-btn:hover { background: color-mix(in oklab, var(--page-bg) 55%, transparent); color: var(--text-primary); }
  .family-btn[aria-pressed="true"] { background: var(--page-bg); color: var(--text-primary); }
  /* Hovering the already-selected row keeps its own fill rather than dimming to the
     generic hover wash above — hover shouldn't visually downgrade a selection. */
  .family-btn[aria-pressed="true"]:hover { background: var(--page-bg); }
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
  .switch-track { position: absolute; inset: 0; border-radius: 999px; background: var(--tint); transition: background 0.15s; }
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
  /* Neutral border darken on hover, not accent — same move .agents-pill:hover
     already makes elsewhere on this page. var(--accent) stays
     reserved exclusively for .active (the instance actually being tested), so
     hovering some other button never reads as "this one's now active too." */
  .test-btn:hover { border-color: var(--text-secondary); }
  .test-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .test-btn.active { border-color: var(--accent); color: var(--accent); }
  .test-btn.active:hover { border-color: var(--accent); }
  input[type="range"].slider-demo {
    appearance: none; -webkit-appearance: none; width: 12rem; background: transparent; cursor: pointer;
  }
  input[type="range"].slider-demo::-webkit-slider-runnable-track {
    height: 2px; border-radius: 999px;
    background: linear-gradient(to right, var(--accent) 0 var(--fill, 50%), var(--tint) var(--fill, 50%) 100%);
  }
  input[type="range"].slider-demo::-webkit-slider-thumb {
    -webkit-appearance: none; width: 0.625rem; height: 0.625rem; border-radius: 50%;
    background: var(--accent); margin-top: -0.25rem; cursor: pointer;
  }
  input[type="range"].slider-demo::-moz-range-track { height: 2px; border-radius: 999px; background: var(--tint); }
  input[type="range"].slider-demo::-moz-range-progress { height: 2px; border-radius: 999px; background: var(--accent); }
  input[type="range"].slider-demo::-moz-range-thumb { width: 0.625rem; height: 0.625rem; border: none; border-radius: 50%; background: var(--accent); cursor: pointer; }

  .sliders { display: flex; flex-direction: column; gap: 0.5rem; }
  .slider-row {
    position: relative; height: 1.75rem; border-radius: var(--radius-sm);
    background: var(--waveform-bg); overflow: hidden;
  }
  .slider-row .fill { position: absolute; inset: 0; width: var(--fill, 0%); background: var(--tint); pointer-events: none; }
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
  .slider-row.is-inert { opacity: 0.45; }
  .slider-row.is-inert input[type="range"] { cursor: not-allowed; }
  .slider-row.is-inert .val { font-family: var(--font-body); font-style: italic; }

  /* Was a standalone pill button; now the same .instance-ctrl-row + .switch pattern
     "Toggle switch" and "Listening" already use above, in the Instance pane — reusing
     their exact CSS as-is, nothing new needed here beyond this row's own top spacing
     (replacing the old button's own margin-top). Label text stays fixed ("View code"),
     never swapping to "Hide code" the old button text did — same convention those two
     switches already use, where the switch's own position communicates state instead
     of the label changing. */
  .code-toggle-row { margin-top: 1.25rem; }
  .code-export {
    position: relative;
    margin-top: 0.6rem; background: var(--page-bg); border: var(--border-width) solid var(--border);
    border-radius: var(--radius-md); padding: 0.85rem;
  }
  .code-export-text {
    margin: 0; padding-right: 1.9rem;
    font-family: var(--font-body); font-size: var(--text-small); font-weight: var(--weight-light); color: var(--text-primary);
    white-space: pre; overflow-x: auto;
  }
  /* Icon-only, matching Phosphor's own regular-weight glyphs (same source/viewBox
     convention as every other icon on the site) — a text "Copy" label doesn't fit this
     panel's own tight corner the way it does the page-level .copy-btn elsewhere. The
     copy icon swaps for a check on success rather than swapping text, since there's no
     text here to swap. */
  .code-copy-btn {
    position: absolute; top: 0.5rem; right: 0.5rem;
    display: flex; align-items: center; justify-content: center;
    width: 1.6rem; height: 1.6rem; padding: 0;
    border: var(--border-width) solid var(--border); background: var(--surface);
    border-radius: var(--radius-sm); cursor: pointer; color: var(--text-secondary);
  }
  .code-copy-btn:hover { border-color: var(--text-secondary); }
  .code-copy-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .code-copy-btn.is-copied { color: var(--accent); border-color: var(--accent); }
  .code-copy-btn svg { display: block; }
  .code-copy-btn .icon-check { display: none; }
  .code-copy-btn.is-copied .icon-copy { display: none; }
  .code-copy-btn.is-copied .icon-check { display: block; }
`;

// The waveform is synthesized directly from each note's own parameters (frequency, volume,
// envelope) — the same data that drives real playback — rather than captured from live audio
// via an AnalyserNode. That capture-based approach was the source of every waveform bug this
// session (hover losing its start to read-timing jitter, scroll jumpiness, buffer sizing):
// this sidesteps all of it by never racing against real audio timing at all. A cue's full
// duration is always visible across the canvas width, redrawn every animation frame while
// playing so it visibly shimmers rather than sitting static — see drawWaveform().

// The shape appears by revealing left-to-right in sync with elapsed time, rather than fading
// in all at once — see drawWaveform's own comment for why that's what actually reads as
// "playing," not a picture materializing. Below this gesture length, the reveal is stretched
// to take at least this long — a 10ms hover sound would otherwise finish revealing before an
// eye could register it moving at all. Longer gestures reveal at close to their own real
// pace, unstretched.
const REVEAL_DURATION_FLOOR_MS = 380;

// How long the fully-revealed shape holds before fading out, and how long that fade takes.
const HOLD_MS = 140;
const FADE_OUT_MS = 160;

// No live phase animation: real acoustic transients are deterministic — the same excitation
// produces the same waveform, every time, exactly reproducible (a scope with its trigger
// synced to the signal's own onset shows two identical strikes overlaying perfectly). A term
// driven by real elapsed wall-clock time would make the shape depend on exactly when a redraw
// happened to land, which isn't how real sound works — see startVisual's phaseOffset for how
// visual variety is produced instead: a fixed, deterministic choice per note, not a live one.

// A note's true audio frequency (hundreds to thousands of Hz) is far too dense to render as
// literal cycles across a ~640px canvas mapped to a gesture that can be under 20ms — it would
// just look like noise. Real frequency is compressed into this range of visual cycles/sec
// instead: higher-pitched notes still show visibly tighter oscillation than lower ones, just
// scaled down to something a canvas this size can actually render as readable detail.
const MIN_VISUAL_HZ = 6;
const MAX_VISUAL_HZ = 30;
const VISUAL_HZ_DIVISOR = 40;

// A note's amplitude envelope: a raised-cosine attack ramp (its own `attack`, or this
// default) into an exponential decay whose time constant is this fraction of the note's own
// duration — long enough to still read as "sounding" for most of the note, short enough to
// audibly/visually taper before the next note (if any) takes over.
const DEFAULT_ATTACK_SEC = 0.003;
const ENVELOPE_TAU_FRACTION = 0.35;

// A real synthesis attack can be 1-2ms — physically real, but on a canvas whose x-axis spans
// the *whole* gesture (which can be 150ms+), that rise occupies only a couple of real
// pixels: by the 2nd or 3rd pixel the envelope is already most of the way to its peak. No
// amount of oversampling or curve smoothing fixes that — there's no physical space to show a
// gradual rise in 2 pixels. Same fix as the frequency compression above: the *visual* attack
// gets a floor, decoupled from the real audio attack, so the eye has enough width to actually
// perceive the shape — purely cosmetic, the real sound's own attack is unaffected.
const MIN_VISUAL_ATTACK_FRACTION = 0.02;

// Target fraction of half-height the loudest point in the gesture's envelope silhouette
// should reach — computed once per trigger from the envelope alone (see startVisual), not
// re-normalized every frame, so the trace's scale doesn't visibly shift while it plays.
const TARGET_PEAK_FRACTION = 0.75;

const FALLBACK_NOTES: Note[] = [{ offsetFraction: 0, lengthFraction: 1, pitchMultiplier: 1, volumeMultiplier: 1 }];

// ---- bar-style waveform, every family — a classic mirrored-amplitude-bar visualizer
// instead of a continuous stroked line. Trialed on soft-bubble alone first, then rolled
// out once confirmed. Wider bars with real gaps between them (rather than a dense hairline
// forest) for
// a softer, more legible read, matching chordal's own quiet visual language elsewhere.
const BAR_WIDTH_PX = 3;
const BAR_GAP_PX = 3;
// Sub-samples taken across each bar's own time slice to find its peak — the carrier
// oscillates much faster than the bar pitch at any real audio pitch, so a single sample
// per bar would alias; this catches the same fast ripple the continuous line already
// renders; taking the max of several samples is what gives the bars their fuzzy,
// authentic "real waveform" texture instead of a smooth envelope silhouette.
const BAR_SUBSAMPLES = 6;
// Headroom so the single loudest bar doesn't touch the canvas edge.
const BAR_HEIGHT_SCALE = 0.92;
// Every bar gets at least this much height (mirrored, so 2x this in total) — keeps quiet
// passages reading as a continuous row of small ticks rather than gaps that could look
// like missing/broken bars.
const BAR_MIN_HALF_HEIGHT_PX = 1;
// Per-bar opacity floor — quiet bars dim rather than vanish, loud bars reach full
// opacity. Modulating opacity by each bar's own amplitude (rather than a flat color)
// approximates the reference images' color-intensity depth without introducing extra
// hues, since this stays on the family's own single accent color throughout.
const BAR_MIN_OPACITY = 0.3;

// Match the canvas's own `width`/`height` attributes in render() — used both there and to
// build the precomputed shape below, so they never drift apart.
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 144;

// Evenly-spaced points across the whole gesture aren't enough on their own: a fast attack
// (a couple of ms) can be a small fraction of a longer overall gesture, so only 1-3 of these
// fall inside it — nowhere near enough to catch its actual peak. This packs extra samples
// densely across each voice's own attack window specifically, on top of the base grid, so
// startVisual's own peakEnvelope/visualGain normalization pass (the one remaining consumer
// of this — see startVisual) resolves every attack accurately regardless of how short it is
// relative to the gesture as a whole. See buildSampleTimes().
const BASE_SAMPLE_COUNT = CANVAS_WIDTH;
const ATTACK_OVERSAMPLE_COUNT = 12;

function clampVisualHz(realFrequencyHz: number): number {
  return Math.min(MAX_VISUAL_HZ, Math.max(MIN_VISUAL_HZ, realFrequencyHz / VISUAL_HZ_DIVISOR));
}

// Builds the full set of gesture-time (seconds) points to evaluate and draw — a uniform base
// grid across the whole gesture, plus dense extra points packed across each voice's own
// attack window (see the constants above for why). Sorted so the render loop can walk it
// left to right in one pass.
function buildSampleTimes(durationSec: number, voices: VisualVoice[]): number[] {
  const times: number[] = [];
  for (let i = 0; i <= BASE_SAMPLE_COUNT; i++) times.push((i / BASE_SAMPLE_COUNT) * durationSec);
  for (const v of voices) {
    for (let i = 0; i <= ATTACK_OVERSAMPLE_COUNT; i++) {
      times.push(v.onsetSec + (i / ATTACK_OVERSAMPLE_COUNT) * v.attack);
    }
  }
  times.sort((a, b) => a - b);
  return times;
}


// Raised-cosine (smoothstep) attack, not a linear ramp: matches the exponential decay's own
// zero-slope start, so the envelope itself — the actual amplitude values every bar's height
// and every gain-normalization pass reads from — rises smoothly into its peak rather than
// arriving with a sudden constant-slope kink.
function attackEnvelope(localT: number, attack: number, tau: number): number {
  const attackProgress = Math.min(1, localT / attack);
  const attackFactor = 0.5 - 0.5 * Math.cos(Math.PI * attackProgress);
  return attackFactor * Math.exp(-localT / tau);
}

// "Nice" tick intervals for the millisecond grid — smallest candidate that keeps the total
// tick count near `targetTicks` for whatever duration is being displayed.
function niceMsStep(totalMs: number, targetTicks = 7): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const raw = totalMs / targetTicks;
  return candidates.find((c) => c >= raw) ?? candidates[candidates.length - 1]!;
}

interface VisualVoice {
  onsetSec: number;
  durationSec: number;
  visualHzStart: number;
  visualHzEnd: number;
  peakAmp: number;
  tau: number;
  attack: number;
  realHz: number; // for the status label — the note's own true audio frequency, unscaled
  phaseOffset: number; // 0 or Math.PI, fixed per voice — see startVisual for how it's derived
}

export class ChordalPlayground extends HTMLElement {
  private shadow: ShadowRoot;
  private family: SoundFamily = getFamily();
  private instance: SoundInstance = 'hover';
  // Separate from `instance` on purpose: 'slider' isn't a member of SoundInstance (it's
  // playContinuous's own action literal, not a play()-triggerable instance — no PRESETS
  // entry exists for it), so it can't just widen `instance`'s own type without breaking
  // every PRESETS[this.family][this.instance] lookup elsewhere. This tracks which control
  // is active for View Code + the test-area highlight only; `instance` keeps meaning "the
  // SoundInstance the tuning sliders/PRESETS lookups apply to" and is left untouched while
  // the slider control is active, since dragging it doesn't change any of that.
  private activeControl: SoundInstance | 'slider' = 'hover';
  private overrides = new Map<string, Partial<InstanceTuning>>();
  private rafId: number | null = null;
  private idleTimer: number | null = null;
  private toggleState: 'on' | 'off' = 'off';
  private listeningState: 'on' | 'off' = 'off';

  // Synthesized (not captured) waveform — see the constants block above and startVisual().
  private voices: VisualVoice[] = [];
  private sampleTimes: number[] = [];
  private gestureStartedAt = 0;
  private gestureDurationSec = 0;
  private visualGain = 1;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.drawWaveform();
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

  /**
   * Builds this gesture's voice list directly from its own notes — one VisualVoice per note,
   * each carrying its onset, duration, frequency (real + visually-compressed), envelope
   * shape, and amplitude. Also precomputes visualGain from the envelope silhouette alone
   * (sampled coarsely across the gesture, ignoring the carrier's instantaneous sign) so the
   * trace's scale is stable for the whole gesture rather than re-normalized every frame.
   */
  private startVisual(preset: InstancePreset): void {
    const baseFrequency = FAMILY_RECIPES[this.family].baseFrequency;
    const durationSec = Math.max(0.001, preset.length);
    this.gestureDurationSec = durationSec;
    const notes = preset.notes.length > 0 ? preset.notes : FALLBACK_NOTES;

    // phaseOffset is a fixed, deliberate stylistic choice tied to the gesture's own pitch
    // trajectory — not a live/real-time one (see the constants block above for why). A note
    // whose pitch sweeps downward, or that lands lower than the note right before it, flips
    // (Math.PI instead of 0) — both are exact zero-crossings of sine, so either choice keeps
    // the envelope's own zero-crossing at localT=0 intact; only what happens after that point
    // changes. This gives a gesture's own descending moments (error's falling tritone, a
    // downward step between notes) a visually distinct signature from its rising/static ones,
    // deterministically — the same gesture produces the exact same shape every single time.
    let previousHz: number | null = null;
    this.voices = notes.map((note) => {
      const noteDurationSec = Math.max(0.001, note.lengthFraction * durationSec);
      const realHz = baseFrequency * preset.pitch * note.pitchMultiplier;
      const realHzEnd = note.sweepTo ? realHz * note.sweepTo : realHz;
      const sweepsDown = note.sweepTo !== undefined && note.sweepTo < 1;
      const stepsDown = previousHz !== null && realHz < previousHz;
      const phaseOffset = sweepsDown || stepsDown ? Math.PI : 0;
      previousHz = realHzEnd;
      return {
        onsetSec: note.offsetFraction * durationSec,
        durationSec: noteDurationSec,
        visualHzStart: clampVisualHz(realHz),
        visualHzEnd: clampVisualHz(realHzEnd),
        peakAmp: preset.volume * note.volumeMultiplier,
        tau: Math.max(0.004, noteDurationSec * ENVELOPE_TAU_FRACTION),
        attack: Math.max(note.attack ?? DEFAULT_ATTACK_SEC, durationSec * MIN_VISUAL_ATTACK_FRACTION),
        realHz,
        phaseOffset,
      };
    });

    this.sampleTimes = buildSampleTimes(durationSec, this.voices);

    // Reuses the same sample times as rendering (rather than a separate coarse probe grid)
    // so a narrow attack peak that would've been missed by uniform-only sampling can't also
    // throw off the gain normalization — the two now see exactly the same resolution. Uses
    // the envelope alone (no carrier/ripple) so the gain doesn't itself wobble with the ripple.
    let peakEnvelope = 0;
    for (const t of this.sampleTimes) {
      let sum = 0;
      for (const v of this.voices) {
        if (t < v.onsetSec) continue;
        sum += v.peakAmp * attackEnvelope(t - v.onsetSec, v.attack, v.tau);
      }
      if (sum > peakEnvelope) peakEnvelope = sum;
    }
    this.visualGain = peakEnvelope > 0.001 ? TARGET_PEAK_FRACTION / peakEnvelope : 1;

    this.gestureStartedAt = performance.now();
  }

  // Sums every active voice's envelope×carrier contribution at one gesture-time instant —
  // the same signal both the continuous-line renderer and the bar renderer draw from, so
  // switching a family between the two styles (see drawWaveform) never changes what's
  // being visualized, only how.
  private sampleSignal(gt: number): number {
    let sum = 0;
    for (const v of this.voices) {
      if (gt < v.onsetSec) continue;
      const localT = gt - v.onsetSec;
      const envelope = attackEnvelope(localT, v.attack, v.tau);
      const noteProgress = Math.min(1, localT / v.durationSec);
      const visualHz = v.visualHzStart + (v.visualHzEnd - v.visualHzStart) * noteProgress;
      sum += v.peakAmp * envelope * Math.sin(2 * Math.PI * visualHz * localT + v.phaseOffset);
    }
    return sum;
  }

  // Faint vertical ticks only — no per-line text (the corner .status label already carries
  // the duration) and no center baseline: the trace itself already breaks around zero during
  // real silence (see drawWaveform's silence-gap handling), so a separately-drawn horizontal
  // reference line only doubled up with it, reading as two overlapping lines through any
  // quiet stretch. Spans however much has been captured so far, not a fixed duration.
  private drawGrid(ctx2d: CanvasRenderingContext2D, w: number, h: number, visibleMs: number): void {
    const step = niceMsStep(visibleMs, 8);
    ctx2d.strokeStyle = '#00000012';
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([]);
    for (let t = 0; t <= visibleMs + 0.001; t += step) {
      const x = (t / visibleMs) * w;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }
  }

  /**
   * Redraws every animation frame while a gesture is active. The shape itself is fully
   * deterministic — every value here (envelope, carrier frequency, phaseOffset) is a pure
   * function of gesture-time and the note's own fixed parameters, none of it driven by real
   * elapsed time; the same gesture produces the exact same trace every single trigger,
   * matching how real acoustic transients behave (see the constants above). What *does* move
   * frame to frame is how much of that fixed trace has been revealed so far — the line draws
   * itself in left to right in sync with elapsed time, like watching a scope sweep across the
   * screen as the sound actually plays, rather than the complete picture just fading into
   * view all at once. That's what makes it read as "playing" instead of "materializing."
   * Once fully revealed, it holds for HOLD_MS, then fades out — no resting line, no grid at
   * idle.
   */
  private drawWaveform = (): void => {
    this.rafId = requestAnimationFrame(this.drawWaveform);
    const canvas = this.shadow.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();
    const elapsedMs = now - this.gestureStartedAt;
    const totalMs = this.gestureDurationSec * 1000;
    const revealDurationMs = Math.max(REVEAL_DURATION_FLOOR_MS, totalMs);
    const fadeOutStart = revealDurationMs + HOLD_MS;
    const lifecycleMs = fadeOutStart + FADE_OUT_MS;

    if (this.voices.length === 0 || elapsedMs < 0 || elapsedMs > lifecycleMs) {
      ctx2d.clearRect(0, 0, w, h); // idle: blank canvas, no curve, no grid — clears promptly
      return;
    }

    const revealGt = Math.min(1, elapsedMs / revealDurationMs) * this.gestureDurationSec;
    let opacity = 1;
    if (elapsedMs > fadeOutStart) opacity = Math.max(0, 1 - (elapsedMs - fadeOutStart) / FADE_OUT_MS);

    ctx2d.clearRect(0, 0, w, h);
    ctx2d.globalAlpha = opacity;
    this.drawGrid(ctx2d, w, h, totalMs);

    // Bar-style visualizer for every family — see drawBars below. Replaced the previous
    // continuous stroked line (one quadraticCurveTo path through this.sampleTimes) after
    // trialing bars on soft-bubble alone first; this.sampleTimes/buildSampleTimes stay in
    // use regardless (see startVisual) for the peakEnvelope/visualGain normalization pass,
    // which is independent of which rendering style consumes it.
    this.drawBars(ctx2d, w, h, revealGt, opacity);
    ctx2d.globalAlpha = 1;
  };

  // Mirrored-amplitude-bar renderer — see the BAR_* constants above for the geometry
  // rationale. Each bar's height is the peak of several sub-samples across its own time
  // slice (not a single sample), which is what gives the bars their fuzzy, authentic
  // texture: the carrier's own fast oscillation shows up as bar-to-bar height variation
  // instead of being aliased away. Bar color stays the family's single accent throughout
  // (no rainbow gradient); each bar's own opacity is modulated by its own amplitude
  // instead, so louder passages still read as visually "hotter" within that one hue.
  private drawBars(ctx2d: CanvasRenderingContext2D, w: number, h: number, revealGt: number, opacity: number): void {
    const barStep = BAR_WIDTH_PX + BAR_GAP_PX;
    const barCount = Math.max(1, Math.floor(w / barStep));
    const barDurationSec = this.gestureDurationSec / barCount;
    const accent = FAMILY_ACCENTS[this.family];

    ctx2d.strokeStyle = accent;
    ctx2d.lineWidth = BAR_WIDTH_PX;
    ctx2d.lineCap = 'round';

    for (let i = 0; i < barCount; i++) {
      const barStartT = i * barDurationSec;
      const barCenterT = barStartT + barDurationSec / 2;
      if (barCenterT > revealGt) break;

      let peak = 0;
      for (let s = 0; s < BAR_SUBSAMPLES; s++) {
        const t = barStartT + ((s + 0.5) / BAR_SUBSAMPLES) * barDurationSec;
        const sample = Math.abs(this.sampleSignal(t));
        if (sample > peak) peak = sample;
      }

      const amp = Math.min(1, peak * this.visualGain);
      const halfHeight = Math.max(BAR_MIN_HALF_HEIGHT_PX, amp * (h / 2) * BAR_HEIGHT_SCALE);
      const x = (i + 0.5) * barStep;

      ctx2d.globalAlpha = opacity * (BAR_MIN_OPACITY + (1 - BAR_MIN_OPACITY) * amp);
      ctx2d.beginPath();
      ctx2d.moveTo(x, h / 2 - halfHeight);
      ctx2d.lineTo(x, h / 2 + halfHeight);
      ctx2d.stroke();
    }
  }

  // Reports the loudest voice's own true (unscaled) frequency — exact, since it's read
  // directly from the synthesis parameters rather than estimated from a waveform.
  private describeFrequency(): string {
    let loudest: VisualVoice | null = null;
    for (const v of this.voices) {
      if (!loudest || v.peakAmp > loudest.peakAmp) loudest = v;
    }
    const hz = loudest?.realHz ?? 0;
    return hz >= 50 ? `${(hz / 1000).toFixed(1)} kHz, ` : '';
  }

  private showStatus(instance: SoundInstance, preset: InstancePreset): void {
    this.startVisual(preset);
    const status = this.shadow.querySelector<HTMLElement>('.status');
    if (!status) return;
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    const durationLabel = `${(preset.length).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0')} s`;
    status.textContent = `${this.family} · ${instance} · ${this.describeFrequency()}${durationLabel}`;
    // Floored, not just preset.length * 1000 + 200 — several instances are genuinely
    // this brief (hover is 11ms, toggle 24ms), so that alone left the status readable
    // for barely 200ms, gone before anyone could actually read it. The 200ms buffer on
    // top of real playback still matters for the longer instances (notification,
    // listening) — this only raises the floor for the short ones, it doesn't touch
    // anything already past it.
    const MIN_STATUS_VISIBLE_MS = 1200;
    this.idleTimer = window.setTimeout(() => {
      status.textContent = 'idle';
    }, Math.max(preset.length * 1000 + 200, MIN_STATUS_VISIBLE_MS));
  }

  private triggerTest(instance: SoundInstance, options: { state?: 'on' | 'off' } = {}): void {
    this.setActiveInstance(instance);
    const key = `${this.family}:${instance}`;
    const override = this.overrides.get(key) ?? {};
    play(instance, { family: this.family, ...override, ...options });
    this.showStatus(instance, { ...PRESETS[this.family][instance], ...override });
  }

  private buildSnippet(): string {
    // slider is playContinuous's own action, not a play()-triggerable SoundInstance (see
    // activeControl above) — a different function with a narrower options shape (no
    // volume/pitch/length/tone; see the four tuning sliders going inert in refreshSliders
    // when this is active), so it gets its own branch rather than forcing it through the
    // play()-shaped template below. Shows the realistic wiring (an input event handler),
    // not a frozen one-off call — a bare literal ratio isn't how this is actually used,
    // same reasoning as docs.html's own playContinuous() card.
    if (this.activeControl === 'slider') {
      return [
        "import { playContinuous } from 'chordal';",
        '',
        "const slider = document.querySelector('#volume');",
        "slider.addEventListener('input', () => {",
        '  const ratio = Number(slider.value) / 100;',
        `  playContinuous('slider', ratio, { family: '${this.family}' });`,
        '});',
      ].join('\n');
    }
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
    // Targets .code-export-text specifically, not the outer .code-export — that div
    // also now holds the copy button as a real sibling element; setting .textContent on
    // the outer wrapper would wipe the button out along with the old snippet text on
    // every refresh.
    const el = this.shadow.querySelector('.code-export-text');
    if (el) el.textContent = this.buildSnippet();
  }

  private refreshSliders(): void {
    const tuning = this.currentTuning();
    const toneAudible = isToneAudible(FAMILY_RECIPES[this.family], PRESETS[this.family][this.instance].notes, tuning);
    // playContinuous only accepts { family } (see buildSnippet's slider branch above) —
    // none of these four tuning knobs actually reach it, so all of them go inert while
    // slider is the active control, not just tone the way it can be per-family otherwise.
    const sliderActive = this.activeControl === 'slider';
    SLIDER_SPECS.forEach((spec) => {
      const input = this.shadow.querySelector<HTMLInputElement>(`input[data-key="${spec.key}"]`);
      const val = this.shadow.querySelector<HTMLElement>(`.val[data-key="${spec.key}"]`);
      const row = input?.closest<HTMLElement>('.slider-row');
      const value = tuning[spec.key];
      const inert = sliderActive || (spec.key === 'tone' && !toneAudible);
      if (input) {
        input.value = String(value);
        input.disabled = inert;
      }
      if (val) val.textContent = inert ? 'unused here' : spec.format(value, FAMILY_RECIPES[this.family].baseFrequency);
      row?.classList.toggle('is-inert', inert);
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
   * Accepts 'slider' too (see activeControl above) — the slider control routes through
   * here as well now, just without touching `instance` itself.
   */
  private setActiveInstance(control: SoundInstance | 'slider'): void {
    this.activeControl = control;
    if (control !== 'slider') this.instance = control;
    this.shadow.querySelectorAll<HTMLElement>('[data-instance-trigger]').forEach((el) => {
      el.classList.toggle('active', el.dataset.instanceTrigger === control);
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
        </div>
        <div class="pane">
          <div class="pane-head">Waveform</div>
          <div class="waveform-wrap">
            <canvas width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></canvas>
            <div class="status">idle</div>
          </div>
          <div class="test-area">
            <div class="instance-group-label">Instance</div>
            <div class="instance-group">
              <div class="instance-pills">
                <button type="button" class="test-btn" data-test="hover" data-instance-trigger="hover">Hover</button>
                <button type="button" class="test-btn" data-test="click" data-instance-trigger="click">Click</button>
                <button type="button" class="test-btn" data-test="success" data-instance-trigger="success">Success</button>
                <button type="button" class="test-btn" data-test="sent" data-instance-trigger="sent">Sent</button>
                <button type="button" class="test-btn" data-test="error" data-instance-trigger="error">Error</button>
                <button type="button" class="test-btn" data-test="notification" data-instance-trigger="notification">Notification</button>
                <button type="button" class="test-btn" data-test="delete" data-instance-trigger="delete">Delete</button>
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
                <span class="instance-ctrl-label">Listening (voice input)</span>
                <label class="switch">
                  <input type="checkbox" data-test="listening" />
                  <span class="switch-track"><span class="switch-knob"></span></span>
                </label>
              </div>
              <div class="instance-ctrl-row">
                <span class="instance-ctrl-label">Slider</span>
                <input type="range" class="slider-demo" min="0" max="100" value="50" data-test="slider" data-instance-trigger="slider" />
              </div>
            </div>
          </div>
        </div>
        <div class="pane">
          <div class="pane-head">Inspector</div>
          <div class="sliders">${slidersHtml}</div>
          <div class="instance-ctrl-row code-toggle-row">
            <span class="instance-ctrl-label">View code</span>
            <label class="switch">
              <input type="checkbox" class="code-toggle-input" />
              <span class="switch-track"><span class="switch-knob"></span></span>
            </label>
          </div>
          <div class="code-export" hidden>
            <button type="button" class="code-copy-btn" aria-label="Copy code">
              <span class="icon-copy" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg></span>
              <span class="icon-check" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg></span>
            </button>
            <pre class="code-export-text"></pre>
          </div>
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

    const codeToggle = this.shadow.querySelector<HTMLInputElement>('.code-toggle-input');
    const codeExport = this.shadow.querySelector<HTMLElement>('.code-export');
    codeToggle?.addEventListener('change', () => {
      codeExport?.toggleAttribute('hidden', !codeToggle.checked);
      // Hardcoded glass-crystal, not this.family — this switch is the playground's own
      // fixed UI chrome (show/hide a panel), not a demo of whatever family a visitor is
      // currently auditioning, so it shouldn't change tone based on that selection.
      // Deliberately NOT routed through setActiveInstance/triggerTest either — unlike
      // the real "Toggle switch" test control above, this one only opens/closes a panel
      // and shouldn't silently change which instance's code View Code is showing.
      // state reads the checkbox's own post-click value (checked === panel now open) —
      // toggle/listening are the two instances play() varies by on/off state (see
      // src/index.ts); without it every click played the same one sound regardless of
      // direction, opening and closing sounding identical.
      play('toggle', { family: 'glass-crystal', state: codeToggle.checked ? 'on' : 'off' });
    });

    const codeCopyBtn = this.shadow.querySelector<HTMLButtonElement>('.code-copy-btn');
    codeCopyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.buildSnippet());
        codeCopyBtn.classList.add('is-copied');
        window.setTimeout(() => codeCopyBtn.classList.remove('is-copied'), 1200);
      } catch {
        // Clipboard write can fail on denied permissions — no fallback text swap here
        // (unlike the page-level .copy-btn's "Press ⌘C") since this button is icon-only.
      }
    });

    SLIDER_SPECS.forEach((spec) => {
      const input = this.shadow.querySelector<HTMLInputElement>(`input[data-key="${spec.key}"]`);
      input?.addEventListener('input', () => {
        const value = Number(input.value);
        const key = this.overrideKey();
        const current = this.overrides.get(key) ?? {};
        this.overrides.set(key, { ...current, [spec.key]: value });
        // Re-derives every slider's displayed value/fill from the new tuning rather than
        // patching just this one — pitch changes can flip whether `tone` is audible at all
        // (see isToneAudible), so that row needs to re-evaluate on every drag, not just on
        // family/instance switches.
        this.refreshSliders();
        this.refreshCodeExport();
        this.triggerTest(this.instance);
      });
    });

    const hoverBtn = this.shadow.querySelector<HTMLElement>('[data-test="hover"]');
    hoverBtn?.addEventListener('pointerenter', () => this.triggerTest('hover'));

    const clickBtn = this.shadow.querySelector<HTMLElement>('[data-test="click"]');
    clickBtn?.addEventListener('pointerdown', () => this.triggerTest('click'));

    const successBtn = this.shadow.querySelector<HTMLElement>('[data-test="success"]');
    successBtn?.addEventListener('click', () => this.triggerTest('success'));

    const toggleInput = this.shadow.querySelector<HTMLInputElement>('[data-test="toggle"]');
    toggleInput?.addEventListener('change', () => {
      this.toggleState = toggleInput.checked ? 'on' : 'off';
      this.triggerTest('toggle', { state: this.toggleState });
    });

    const errorBtn = this.shadow.querySelector<HTMLElement>('[data-test="error"]');
    errorBtn?.addEventListener('click', () => this.triggerTest('error'));

    const sentBtn = this.shadow.querySelector<HTMLElement>('[data-test="sent"]');
    sentBtn?.addEventListener('click', () => this.triggerTest('sent'));

    const notificationBtn = this.shadow.querySelector<HTMLElement>('[data-test="notification"]');
    notificationBtn?.addEventListener('click', () => this.triggerTest('notification'));

    const deleteBtn = this.shadow.querySelector<HTMLElement>('[data-test="delete"]');
    deleteBtn?.addEventListener('click', () => this.triggerTest('delete'));

    const listeningInput = this.shadow.querySelector<HTMLInputElement>('[data-test="listening"]');
    listeningInput?.addEventListener('change', () => {
      this.listeningState = listeningInput.checked ? 'on' : 'off';
      this.triggerTest('listening', { state: this.listeningState });
    });

    const sliderDemo = this.shadow.querySelector<HTMLInputElement>('[data-test="slider"]');
    sliderDemo?.style.setProperty('--fill', `${sliderDemo.value}%`);
    sliderDemo?.addEventListener('input', () => {
      // Routes through the same instance-tracking every other test control uses (see
      // activeControl above) — without this, View Code never picks up the slider
      // interaction at all, and the tuning sliders never go inert for it either.
      this.setActiveInstance('slider');
      const ratio = Number(sliderDemo.value) / 100;
      sliderDemo.style.setProperty('--fill', `${sliderDemo.value}%`);
      playContinuous('slider', ratio, { family: this.family });
      // playContinuous's own note shape isn't exposed here — the family's own hover preset,
      // forced to a short length, is a reasonable stand-in visual for the tick.
      this.startVisual({ ...PRESETS[this.family].hover, length: 0.03 });
      const status = this.shadow.querySelector<HTMLElement>('.status');
      if (status) status.textContent = `${this.family} · slider · ${ratio.toFixed(2)}`;
    });
  }
}

if (!customElements.get('chordal-playground')) {
  customElements.define('chordal-playground', ChordalPlayground);
}
