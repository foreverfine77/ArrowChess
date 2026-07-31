import { describe, expect, it, beforeEach } from 'vitest';
import {
  isMuted,
  setMuted,
  toggleMute,
  getVolume,
  setVolume,
  resetAudioState,
  getBGMState,
} from '../../miniprogram/audio';

describe('audio module', () => {
  beforeEach(() => {
    // 重置模块内部状态，避免跨测试污染
    resetAudioState();
  });

  it('starts unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('setMuted changes the muted state', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('toggleMute flips the state and returns the new value', () => {
    expect(toggleMute()).toBe(true);   // false → true
    expect(isMuted()).toBe(true);
    expect(toggleMute()).toBe(false);  // true → false
    expect(isMuted()).toBe(false);
  });

  it('starts with volume 1 (full)', () => {
    expect(getVolume()).toBe(1);
  });

  it('setVolume clamps to [0, 1]', () => {
    setVolume(0.5);
    expect(getVolume()).toBe(0.5);
    setVolume(1.5);
    expect(getVolume()).toBe(1);
    setVolume(-0.3);
    expect(getVolume()).toBe(0);
  });

  it('resetAudioState restores defaults', () => {
    setMuted(true);
    setVolume(0.3);
    resetAudioState();
    expect(isMuted()).toBe(false);
    expect(getVolume()).toBe(1);
  });

  it('starts with BGM uninitialized (no inner audio context created yet)', () => {
    expect(getBGMState()).toBe('uninitialized');
  });
});
