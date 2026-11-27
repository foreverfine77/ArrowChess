import { describe, expect, it } from 'vitest';
import { pointXY, boardCornerRadius } from '../src/renderer';
import type { Layout } from '../src/renderer';

describe('board corner radius matches corner point circles', () => {
  const layout: Layout = { size: 420, padding: 36 };

  it('corner point (1) is at distance = padding from the top-left corner of the board', () => {
    const p1 = pointXY(layout, 1);
    // 点 1 应该在 (padding, padding)，即距离左上角 padding 距离
    expect(p1.x).toBeCloseTo(layout.padding, 0);
    expect(p1.y).toBeCloseTo(layout.padding, 0);
  });

  it('boardCornerRadius equals padding so the rounded corner is concentric with corner point circles', () => {
    const r = boardCornerRadius(layout);
    expect(r).toBe(layout.padding);
  });

  it('corner points 1, 3, 7, 9 each share their center with the respective rounded corner arc', () => {
    const r = boardCornerRadius(layout);
    const size = layout.size;

    const p1 = pointXY(layout, 1);
    // 左上角圆角的圆心 = (r, r)，应等于点 1 的圆心（同圆心）
    expect(p1.x).toBeCloseTo(r, 0);
    expect(p1.y).toBeCloseTo(r, 0);

    const p3 = pointXY(layout, 3);
    // 右上角圆角的圆心 = (size - r, r)
    expect(p3.x).toBeCloseTo(size - r, 0);
    expect(p3.y).toBeCloseTo(r, 0);

    const p7 = pointXY(layout, 7);
    // 左下角圆角的圆心 = (r, size - r)
    expect(p7.x).toBeCloseTo(r, 0);
    expect(p7.y).toBeCloseTo(size - r, 0);

    const p9 = pointXY(layout, 9);
    // 右下角圆角的圆心 = (size - r, size - r)
    expect(p9.x).toBeCloseTo(size - r, 0);
    expect(p9.y).toBeCloseTo(size - r, 0);
  });

  it('works for different layout sizes (scales proportionally)', () => {
    const small: Layout = { size: 200, padding: 20 };
    expect(boardCornerRadius(small)).toBe(20);
    const p1 = pointXY(small, 1);
    // 同圆心：点 1 坐标 = 圆角圆心 = (padding, padding)
    expect(p1.x).toBeCloseTo(20, 0);
    expect(p1.y).toBeCloseTo(20, 0);
  });
});
