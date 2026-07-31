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
    expect(r.titleY).toBeGreaterThan(r.logoY);
    expect(r.taglineY).toBeGreaterThan(r.titleY);
    expect(r.hintY).toBeGreaterThan(r.taglineY);
  });

  it('keeps the logo above the vertical center of the screen', () => {
    const r = computeWelcomeLayout(375, 667);
    expect(r.logoY).toBeLessThan(667 / 2);
  });

  it('respects top safe area so the logo is not hidden by notch/camera', () => {
    const r = computeWelcomeLayout(375, 667);
    expect(r.topSafe).toBeGreaterThanOrEqual(20);
    expect(r.logoY).toBeGreaterThanOrEqual(r.topSafe);
  });

  it('hint (tap to start) sits in the lower third of the screen', () => {
    const sh = 667;
    const r = computeWelcomeLayout(375, sh);
    expect(r.hintY).toBeGreaterThan(sh * 2 / 3);
  });

  it('scales sizes proportionally with screen width', () => {
    const small = computeWelcomeLayout(320, 568);
    const big = computeWelcomeLayout(414, 736);
    expect(big.logoSize).toBeGreaterThan(small.logoSize);
    expect(big.titleSize).toBeGreaterThan(small.titleSize);
  });
});
