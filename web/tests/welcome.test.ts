import { describe, expect, it } from 'vitest';
import { computeWelcomeLayout, WELCOME_LAYOUT_VERSION } from '../../miniprogram/welcome';

describe('welcome page layout', () => {
  it('exports a version constant (sanity check that module loads)', () => {
    expect(typeof WELCOME_LAYOUT_VERSION).toBe('number');
    expect(WELCOME_LAYOUT_VERSION).toBeGreaterThan(0);
  });

  it('returns layout fields for a typical phone size', () => {
    const r = computeWelcomeLayout(375, 667);
    expect(r.logoY).toBeGreaterThan(0);
    expect(r.taglineY).toBeGreaterThan(r.logoY + r.logoSize);
    expect(r.hintY).toBeGreaterThan(r.taglineY);
  });

  it('logo sits in the upper third of the screen', () => {
    const sh = 667;
    const r = computeWelcomeLayout(375, sh);
    // logo 视觉中心位于屏幕 1/3 附近（约 27% 高度处，略高于 1/3）
    const logoCenter = r.logoY + r.logoSize / 2;
    expect(logoCenter).toBeGreaterThan(sh * 0.2);
    expect(logoCenter).toBeLessThan(sh * 0.38);
  });

  it('tagline (八字标语) sits in the lower third of the screen', () => {
    const sh = 667;
    const r = computeWelcomeLayout(375, sh);
    // 标语位于屏幕 2/3 附近
    expect(r.taglineY).toBeGreaterThan(sh * 0.55);
    expect(r.taglineY).toBeLessThan(sh * 0.75);
  });

  it('respects top safe area so the logo is not hidden by notch/camera', () => {
    const r = computeWelcomeLayout(375, 667);
    expect(r.topSafe).toBeGreaterThanOrEqual(20);
    expect(r.logoY).toBeGreaterThanOrEqual(r.topSafe);
  });

  it('hint (tap to start) sits in the lower part of the screen', () => {
    const sh = 667;
    const r = computeWelcomeLayout(375, sh);
    expect(r.hintY).toBeGreaterThan(sh * 0.8);
  });

  it('scales sizes proportionally with screen width', () => {
    const small = computeWelcomeLayout(320, 568);
    const big = computeWelcomeLayout(414, 736);
    expect(big.logoSize).toBeGreaterThan(small.logoSize);
    expect(big.taglineSize).toBeGreaterThan(small.taglineSize);
  });
});
