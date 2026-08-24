import { describe, expect, it } from 'vitest';
import { SOUND_FAMILIES, SOUND_INSTANCES, bind, getFamily, isMuted, mute, play, playContinuous, setFamily, unmute } from './index';

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
