import { describe, expect, it } from 'vitest';
import {
  FAMILY_RECIPES,
  PRESETS,
  SOUND_FAMILIES,
  SOUND_INSTANCES,
  isToneAudible,
  resolveNoteParams,
  resolveToggleTuning,
} from './presets';

describe('resolveNoteParams', () => {
  for (const family of SOUND_FAMILIES) {
    for (const instance of SOUND_INSTANCES) {
      const preset = PRESETS[family][instance];

      it(`produces valid SynthParams for every note of ${family}/${instance}`, () => {
        for (const note of preset.notes) {
          const params = resolveNoteParams(family, preset, note);

          expect(Number.isFinite(params.frequency)).toBe(true);
          expect(params.frequency).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(params.volume)).toBe(true);
          expect(params.volume).toBeGreaterThanOrEqual(0);
          expect(params.volume).toBeLessThanOrEqual(1);
          expect(Number.isFinite(params.length)).toBe(true);
          expect(params.length).toBeGreaterThan(0);

          if (params.filterCutoff !== undefined) {
            expect(Number.isFinite(params.filterCutoff)).toBe(true);
            expect(params.filterCutoff).toBeGreaterThan(0);
          }
          if (params.filterQ !== undefined) {
            expect(Number.isFinite(params.filterQ)).toBe(true);
            expect(params.filterQ).toBeGreaterThan(0);
          }
          if (params.endFrequency !== undefined) {
            expect(Number.isFinite(params.endFrequency)).toBe(true);
            expect(params.endFrequency).toBeGreaterThan(0);
          }
        }
      });
    }
  }

  it('never produces a tone value outside the 0-1 range the family recipe expects', () => {
    for (const family of SOUND_FAMILIES) {
      const recipe = FAMILY_RECIPES[family];
      const [cutoffLow, cutoffHigh] = recipe.filterCutoffRange;
      expect(cutoffLow).toBeGreaterThan(0);
      expect(cutoffHigh).toBeGreaterThan(cutoffLow);
    }
  });
});

describe('isToneAudible', () => {
  // Regression coverage for the bug this function exists to surface in the UI: `tone`
  // only moves a filter cutoff, and a pure sine has no harmonic content beyond its one
  // fundamental — so a filter that never reaches the fundamental makes tone a no-op.
  it('is false for soft-bubble/toggle, which bypasses the filter entirely (useFilter: false)', () => {
    const tuning = PRESETS['soft-bubble'].toggle;
    expect(isToneAudible('soft-bubble', 'toggle', tuning)).toBe(false);
  });

  it('is true for soft-bubble/hover now that the filter range crosses its register', () => {
    const tuning = PRESETS['soft-bubble'].hover;
    expect(isToneAudible('soft-bubble', 'hover', tuning)).toBe(true);
  });

  it('is true for metallic-tact/hover, a square wave with real harmonic content', () => {
    const tuning = PRESETS['metallic-tact'].hover;
    expect(isToneAudible('metallic-tact', 'hover', tuning)).toBe(true);
  });

  it('is true for paper-snap/hover, a noise source with full-spectrum content', () => {
    const tuning = PRESETS['paper-snap'].hover;
    expect(isToneAudible('paper-snap', 'hover', tuning)).toBe(true);
  });

  it('is true for soft-bubble/congrats via its tone-scaled sweep, independent of the filter', () => {
    const tuning = PRESETS['soft-bubble'].congrats;
    expect(isToneAudible('soft-bubble', 'congrats', tuning)).toBe(true);
  });

  it('returns a boolean for every family/instance combination without throwing', () => {
    for (const family of SOUND_FAMILIES) {
      for (const instance of SOUND_INSTANCES) {
        const tuning = PRESETS[family][instance];
        expect(typeof isToneAudible(family, instance, tuning)).toBe('boolean');
      }
    }
  });
});

describe('resolveToggleTuning', () => {
  it('returns tuning overrides for both on and off without throwing, for every family', () => {
    for (const family of SOUND_FAMILIES) {
      const base = PRESETS[family].toggle;
      expect(() => resolveToggleTuning(base, 'on')).not.toThrow();
      expect(() => resolveToggleTuning(base, 'off')).not.toThrow();
    }
  });
});
