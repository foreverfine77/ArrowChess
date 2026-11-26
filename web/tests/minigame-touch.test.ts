import { describe, expect, it } from 'vitest';
import { computeBoardLayout, pointFromScreen } from '../../miniprogram/game';
import { pointXY } from '../../miniprogram/src/renderer';
import type { Point } from '../../miniprogram/core/index';

const POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as Point[];

describe('minigame board layout and tap mapping', () => {
  it('fits a square board inside the screen and centers it horizontally', () => {
    const { layout, offsetX, offsetY } = computeBoardLayout(375, 667);
    const expected = Math.floor(Math.min(375 - 32, 667 - 32 - 56));
    expect(layout.size).toBe(expected);
    expect(offsetX).toBe(Math.floor((375 - expected) / 2));
    expect(offsetY).toBe(16);
  });

  it('maps a tap at each point screen position back to that point', () => {
    const { layout, offsetX, offsetY } = computeBoardLayout(375, 667);
    for (const p of POINTS) {
      const local = pointXY(layout, p);
      expect(pointFromScreen(offsetX + local.x, offsetY + local.y, layout, offsetX, offsetY)).toBe(p);
    }
  });

  it('returns null for a tap in the HUD area below the board', () => {
    const { layout, offsetX, offsetY } = computeBoardLayout(375, 667);
    expect(pointFromScreen(offsetX, offsetY + layout.size + 40, layout, offsetX, offsetY)).toBeNull();
  });
});
