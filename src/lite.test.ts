import { describe, expect, it, vi } from 'vitest';
import { createPlayer } from './lite';
import chime from './families/chime';
import metallicTact from './families/metallic-tact';
import { SOUND_INSTANCES } from './types';
import * as engine from './engine';

describe('createPlayer (per-family import path)', () => {
  it('play() does not throw for every instance of a single imported family, with no window present', () => {
    const { play } = createPlayer(chime);
    for (const instance of SOUND_INSTANCES) {
      expect(() => play(instance)).not.toThrow();
    }
  });

  it('play() with the toggle instance does not throw for either state', () => {
    const { play } = createPlayer(chime);
    expect(() => play('toggle', { state: 'on' })).not.toThrow();
    expect(() => play('toggle', { state: 'off' })).not.toThrow();
  });

  it('a manual pitch override still preserves the on/off pitch gap for stateful instances', () => {
    // Same regression as index.test.ts's version — createPlayer()'s own play() had the
    // identical bug (state split applied before the override merge instead of after).
    const { play } = createPlayer(chime);
    const spy = vi.spyOn(engine, 'playVoice');

    for (const instance of ['toggle', 'listening'] as const) {
      // A tonal (non-zero-frequency) note — listening's own first note is a noise tick,
      // whose frequency field is always 0 regardless of pitch, so calls[0] isn't
      // representative for every instance.
      spy.mockClear();
      play(instance, { pitch: 1.5, state: 'on' });
      const onFrequency = spy.mock.calls.map((c) => c[1].frequency).find((f) => f > 0);

      spy.mockClear();
      play(instance, { pitch: 1.5, state: 'off' });
      const offFrequency = spy.mock.calls.map((c) => c[1].frequency).find((f) => f > 0);

      expect(onFrequency).toBeGreaterThan(0);
      expect(offFrequency).toBeGreaterThan(0);
      expect(offFrequency).toBeLessThan(onFrequency!);
    }

    spy.mockRestore();
  });

  it('bind() does not throw when there is no document to scan', () => {
    const { bind } = createPlayer(metallicTact);
    expect(() => bind({ querySelectorAll: () => [] } as unknown as ParentNode)).not.toThrow();
  });

  it('two independently created players do not interfere with each other', () => {
    const a = createPlayer(chime);
    const b = createPlayer(metallicTact);
    expect(() => a.play('hover')).not.toThrow();
    expect(() => b.play('hover')).not.toThrow();
  });

  it('playContinuous() does not throw across the ratio range', () => {
    const { playContinuous } = createPlayer(chime);
    expect(() => playContinuous('slider', 0)).not.toThrow();
    expect(() => playContinuous('slider', 0.5)).not.toThrow();
    expect(() => playContinuous('slider', 1)).not.toThrow();
  });

  it("two independently created players' playContinuous debounce state does not interfere with each other", () => {
    // Regression test for the reason continuous.ts's SliderState is passed in rather than
    // held at module scope: if two createPlayer() calls accidentally shared one debounce
    // clock, player b's call landing right after player a's (well within the 20ms debounce
    // window) would be silently swallowed — a's tick would suppress b's.
    const spy = vi.spyOn(engine, 'playVoice');
    const a = createPlayer(chime);
    const b = createPlayer(metallicTact);

    a.playContinuous('slider', 0.2);
    const aCalls = spy.mock.calls.length;
    expect(aCalls).toBeGreaterThan(0);

    spy.mockClear();
    b.playContinuous('slider', 0.6);
    expect(spy.mock.calls.length).toBeGreaterThan(0);

    spy.mockRestore();
  });
});
