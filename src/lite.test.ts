import { describe, expect, it } from 'vitest';
import { createPlayer } from './lite';
import chime from './families/chime';
import metallicTact from './families/metallic-tact';
import { SOUND_INSTANCES } from './types';

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
});
