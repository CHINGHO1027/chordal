import { describe, expect, it, vi } from 'vitest';
import { SOUND_FAMILIES, SOUND_INSTANCES, bind, getFamily, isMuted, mute, play, playContinuous, setFamily, unmute } from './index';
import * as engine from './engine';

// Vitest's default environment has no `window` — this is the same environment a Node
// SSR render happens in, so these tests double as a genuine check of the "safe to import
// during SSR" claim in the docs, not just a mock. engine.ts's getContext() is documented
// to return null and no-op in this environment rather than throw (see engine.ts).
describe('SSR safety (no window/AudioContext present)', () => {
  it('play() does not throw for any family/instance combination', () => {
    for (const family of SOUND_FAMILIES) {
      for (const instance of SOUND_INSTANCES) {
        expect(() => play(instance, { family })).not.toThrow();
      }
    }
  });

  it('play() with the toggle instance does not throw for either state', () => {
    for (const family of SOUND_FAMILIES) {
      expect(() => play('toggle', { family, state: 'on' })).not.toThrow();
      expect(() => play('toggle', { family, state: 'off' })).not.toThrow();
    }
  });

  it('a manual pitch override still preserves the on/off pitch gap for stateful instances', () => {
    // Regression test: play() used to apply the state-driven pitch split (toggle/listening's
    // on vs off) to the preset's own default pitch, then let a manual `pitch` override
    // replace that result outright — collapsing on and off to the exact same frequency
    // whenever a caller overrode pitch. Fixed by applying the state split after the
    // override is merged in, so the override becomes the "on" pitch and "off" still drops
    // proportionally underneath it.
    const spy = vi.spyOn(engine, 'playVoice');

    for (const instance of ['toggle', 'listening'] as const) {
      // A tonal (non-zero-frequency) note — listening's own first note is a noise tick,
      // whose frequency field is always 0 regardless of pitch, so calls[0] isn't
      // representative for every instance.
      spy.mockClear();
      play(instance, { family: 'chime', pitch: 1.5, state: 'on' });
      const onFrequency = spy.mock.calls.map((c) => c[1].frequency).find((f) => f > 0);

      spy.mockClear();
      play(instance, { family: 'chime', pitch: 1.5, state: 'off' });
      const offFrequency = spy.mock.calls.map((c) => c[1].frequency).find((f) => f > 0);

      expect(onFrequency).toBeGreaterThan(0);
      expect(offFrequency).toBeGreaterThan(0);
      expect(offFrequency).toBeLessThan(onFrequency!);
    }

    spy.mockRestore();
  });

  it('playContinuous() does not throw across the ratio range', () => {
    expect(() => playContinuous('slider', 0)).not.toThrow();
    expect(() => playContinuous('slider', 0.5)).not.toThrow();
    expect(() => playContinuous('slider', 1)).not.toThrow();
  });

  it('bind() does not throw when there is no document to scan', () => {
    expect(() => bind({ querySelectorAll: () => [] } as unknown as ParentNode)).not.toThrow();
  });

  it('mute()/unmute()/isMuted() do not throw and stay consistent', () => {
    expect(() => mute()).not.toThrow();
    expect(isMuted()).toBe(true);
    expect(() => unmute()).not.toThrow();
    expect(isMuted()).toBe(false);
  });
});

describe('setFamily()/getFamily()', () => {
  it('round-trips every family', () => {
    for (const family of SOUND_FAMILIES) {
      setFamily(family);
      expect(getFamily()).toBe(family);
    }
  });
});
