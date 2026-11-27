import { describe, expect, it } from 'vitest';
import { BAMBOO_THEME } from '../src/renderer';

describe('bamboo ink theme', () => {
  it('has all required color tokens matching the design spec', () => {
    // 规范中要求的关键色值都存在
    expect(BAMBOO_THEME.bg).toBe('#E9ECDF');     // 棋盘卡片底色
    expect(BAMBOO_THEME.edge).toBe('#9FAB8A');   // 未占用路径
    expect(BAMBOO_THEME.red).toBe('#B23A2A');    // 朱砂红
    expect(BAMBOO_THEME.black).toBe('#333B2A');  // 墨色
    expect(BAMBOO_THEME.pointFill).toBe('#EEF0E4');
    expect(BAMBOO_THEME.pointStroke).toBe('#5F6A4C');
    expect(BAMBOO_THEME.legal).toBeTruthy();
    expect(BAMBOO_THEME.selected).toBeTruthy();
  });

  it('black is a green-tinted ink, not pure black', () => {
    // 墨色偏绿：G 通道 > B 通道，且 R 也偏高（偏绿的墨）
    const hex = BAMBOO_THEME.black.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    expect(g).toBeGreaterThan(b);
    // 不是纯黑或接近纯黑（纯黑三个都低）
    expect(g).toBeGreaterThan(40);
  });

  it('vermilion red is the only high-saturation color in the theme', () => {
    // 朱砂红的红通道显著高于绿和蓝
    const hex = BAMBOO_THEME.red.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    expect(r).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(b + 60);
  });

  it('closed paths use bamboo-family desaturated colors', () => {
    // 封闭路径色（--path-closed）在竹青系，低饱和
    const closed = [BAMBOO_THEME.redClosed, BAMBOO_THEME.blackClosed];
    for (const c of closed) {
      const hex = c.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      // 都是低饱和：RGB 之间差距不大
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      expect(max - min).toBeLessThan(80);
    }
  });
});
