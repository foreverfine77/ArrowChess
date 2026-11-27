import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * 字体加载测试（接缝：loadTitleFont 函数 + TITLE_FONT_FAMILY 常量）。
 *
 * 测试目标：小游戏中 Ma Shan Zheng 毛笔字体应通过 wx.loadFontFace 正确加载，
 * 这样 Canvas 中 ctx.font = '"Ma Shan Zheng", ...' 才能真正生效，而不是回退到系统宋体。
 *
 * 接缝说明：
 * - TITLE_FONT_FAMILY：标题字体族常量（纯值，可直接断言）
 * - loadTitleFont()：字体加载函数，内部调用 wx.loadFontFace
 *   （通过 mock wx.loadFontFace 来验证调用参数）
 */
describe('minigame title font loading', () => {
  let loadFontFaceCalls: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    loadFontFaceCalls = [];
    // 模拟微信小游戏全局 wx 对象
    (globalThis as any).wx = {
      loadFontFace: vi.fn((opts: Record<string, unknown>) => {
        loadFontFaceCalls.push(opts);
        // 默认成功
        if (opts.success) opts.success({ status: 'loaded' });
      }),
    };
  });

  it('exports TITLE_FONT_FAMILY starting with Ma Shan Zheng', async () => {
    const { TITLE_FONT_FAMILY } = await import('../../miniprogram/game');

    expect(TITLE_FONT_FAMILY).toBeTruthy();
    // 第一选择应该是 Ma Shan Zheng 毛笔体
    expect(TITLE_FONT_FAMILY).toMatch(/["']?Ma\s+Shan\s+Zheng["']?/i);
  });

  it('loadTitleFont calls wx.loadFontFace with Ma Shan Zheng family', async () => {
    const { loadTitleFont } = await import('../../miniprogram/game');

    await loadTitleFont();

    const fontCall = loadFontFaceCalls.find(
      (c) => typeof c.family === 'string' && /Ma\s+Shan\s+Zheng/i.test(c.family),
    );
    expect(fontCall).toBeDefined();
  });

  it('supplies a valid font source URL (ttf/woff/woff2) for Ma Shan Zheng', async () => {
    const { loadTitleFont } = await import('../../miniprogram/game');

    await loadTitleFont();

    const fontCall = loadFontFaceCalls.find(
      (c) => typeof c.family === 'string' && /Ma\s+Shan\s+Zheng/i.test(c.family),
    );
    expect(fontCall).toBeDefined();
    expect(typeof fontCall!.source).toBe('string');
    // source 应为 url("...") 格式，指向 ttf/woff/woff2 字体文件
    expect(fontCall!.source).toMatch(/^url\(/i);
    expect(fontCall!.source).toMatch(/\.(ttf|woff2?)/i);
  });

  it('resolves promise even when font loading fails (graceful fallback)', async () => {
    // 模拟 loadFontFace 失败
    (globalThis as any).wx.loadFontFace = vi.fn((opts: any) => {
      loadFontFaceCalls.push(opts);
      if (opts.fail) opts.fail({ errMsg: 'network error' });
    });

    const { loadTitleFont } = await import('../../miniprogram/game');

    // 字体加载失败不应抛出异常——游戏仍应正常运行，只是回退到系统字体
    await expect(loadTitleFont()).resolves.not.toThrow();
  });

  it('drawHeader uses TITLE_FONT_FAMILY in the canvas font string', async () => {
    // 验证 drawHeader 中使用的字体字符串来自 TITLE_FONT_FAMILY（接缝：常量引用）
    // 读取 game.ts 源码来确认 drawHeader 的 font 赋值使用了该常量
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../miniprogram/game.ts'),
      'utf-8',
    );

    // drawHeader 函数中应该引用 TITLE_FONT_FAMILY（或等价常量），
    // 而不是硬编码字符串——这样才能保证加载的字体和使用的字体族一致
    const drawHeaderMatch = source.match(/function\s+drawHeader[\s\S]*?^\}/m);
    expect(drawHeaderMatch).toBeTruthy();
    const drawHeaderBody = drawHeaderMatch![0];
    expect(drawHeaderBody).toMatch(/TITLE_FONT_FAMILY|titleFontFamily|fontFamily/);
  });
});
