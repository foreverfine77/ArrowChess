import { describe, expect, it } from 'vitest';
import { computeHeaderLayout, TITLE_TEXT, RULE_LINES } from '../../miniprogram/game';

describe('minigame header layout', () => {
  it('has a title and a rule subtitle above the board', () => {
    expect(TITLE_TEXT).toBeTruthy();
    expect(RULE_LINES).toBeTruthy();
    expect(RULE_LINES.length).toBeGreaterThanOrEqual(3);
    // 规则文案包含关键句
    expect(RULE_LINES.join('')).toContain('无路可行者负');
  });

  it('places the board below the header area', () => {
    const { headerHeight, boardY } = computeHeaderLayout(375, 667);
    expect(headerHeight).toBeGreaterThan(40); // 至少两行文字
    expect(boardY).toBeGreaterThan(headerHeight); // 棋盘在标题下方
    expect(boardY).toBeGreaterThan(60); // 棋盘明显下移，避开顶部
  });

  it('respects a top safe area so the title is not hidden by the notch/camera', () => {
    const { topSafe, titleY } = computeHeaderLayout(375, 667);
    // 顶部至少留出状态栏高度的空间，标题不能贴顶
    expect(topSafe).toBeGreaterThanOrEqual(20);
    expect(titleY).toBeGreaterThanOrEqual(topSafe);
  });

  it('leaves comfortable spacing between the rule text and the board', () => {
    const { headerHeight, boardY } = computeHeaderLayout(375, 667);
    const gap = boardY - headerHeight;
    // 标题区底部到棋盘之间的间距不应太小（视觉呼吸感）
    expect(gap).toBeGreaterThanOrEqual(16);
  });

  it('renders the rule intro in three centered lines', () => {
    const { ruleLines, titleSize, ruleSize } = computeHeaderLayout(375, 667);
    expect(ruleLines).toHaveLength(3);
    // 三行文字，每行非空
    for (const line of ruleLines) {
      expect(line.length).toBeGreaterThan(2);
    }
    // 标题比规则文字大不少（题匾感）
    expect(titleSize).toBeGreaterThan(ruleSize * 1.8);
  });

  it('header height scales with screen width (wider screen = bigger text = taller header)', () => {
    const narrow = computeHeaderLayout(320, 600);
    const wide = computeHeaderLayout(480, 800);
    expect(wide.headerHeight).toBeGreaterThanOrEqual(narrow.headerHeight);
  });
});
