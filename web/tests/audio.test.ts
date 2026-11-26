import { describe, expect, it, beforeEach } from 'vitest';
import {
  isMuted,
  setMuted,
  toggleMute,
  getVolume,
  setVolume,
  resetAudioState,
  getBGMState,
  getVolumeLevel,
  setVolumeLevel,
  cycleVolumeLevel,
  getBGMVolume,
} from '../../miniprogram/audio';

describe('audio module', () => {
  beforeEach(() => {
    // 重置模块内部状态，避免跨测试污染
    resetAudioState();
  });

  it('starts unmuted at medium level (level 2)', () => {
    expect(isMuted()).toBe(false);
    expect(getVolumeLevel()).toBe(2);
  });

  it('setMuted changes the muted state', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(getVolumeLevel()).toBe(0);
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(getVolumeLevel()).toBe(2);
  });

  it('toggleMute flips the state and returns the new value', () => {
    expect(toggleMute()).toBe(true);   // false → true
    expect(isMuted()).toBe(true);
    expect(toggleMute()).toBe(false);  // true → false
    expect(isMuted()).toBe(false);
  });

  it('cycleVolumeLevel loops through 4 levels: 2→3→0→1→2', () => {
    // 初始是中档 2
    expect(getVolumeLevel()).toBe(2);
    expect(cycleVolumeLevel()).toBe(3); // 2→3 (高)
    expect(cycleVolumeLevel()).toBe(0); // 3→0 (静音)
    expect(isMuted()).toBe(true);
    expect(cycleVolumeLevel()).toBe(1); // 0→1 (低)
    expect(isMuted()).toBe(false);
    expect(cycleVolumeLevel()).toBe(2); // 1→2 (中)
    expect(getVolumeLevel()).toBe(2);
  });

  it('setVolumeLevel clamps to [0, 3]', () => {
    setVolumeLevel(1);
    expect(getVolumeLevel()).toBe(1);
    setVolumeLevel(5);
    expect(getVolumeLevel()).toBe(3);
    setVolumeLevel(-1);
    expect(getVolumeLevel()).toBe(0);
  });

  it('BGM volume matches the level', () => {
    setVolumeLevel(0);
    expect(getBGMVolume()).toBe(0);
    setVolumeLevel(1);
    expect(getBGMVolume()).toBeCloseTo(0.25);
    setVolumeLevel(2);
    expect(getBGMVolume()).toBeCloseTo(0.55);
    setVolumeLevel(3);
    expect(getBGMVolume()).toBeCloseTo(0.9);
  });

  it('getVolume is compatible and returns BGM volume', () => {
    setVolumeLevel(2);
    expect(getVolume()).toBeCloseTo(0.55);
  });

  it('setVolume maps continuous value to nearest level', () => {
    setVolume(0);
    expect(getVolumeLevel()).toBe(0);
    setVolume(0.1);
    expect(getVolumeLevel()).toBe(1);
    setVolume(0.5);
    expect(getVolumeLevel()).toBe(2);
    setVolume(0.95);
    expect(getVolumeLevel()).toBe(3);
  });

  it('resetAudioState restores defaults', () => {
    setVolumeLevel(0);
    resetAudioState();
    expect(isMuted()).toBe(false);
    expect(getVolumeLevel()).toBe(2);
  });

  it('starts with BGM uninitialized (no inner audio context created yet)', () => {
    expect(getBGMState()).toBe('uninitialized');
  });
});
