import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../core/src/index';
import * as renderer from '../src/renderer';

type ArrowSpec = { from: number; to: number; frac: number };

function arrowSpecs(edge: { arrows: 0 | 1 | 2; returnStart: 1 | 2 | null }): ArrowSpec[] {
  expect(typeof (renderer as Record<string, unknown>).edgeArrowSpecs).toBe('function');
  return (renderer as unknown as {
    edgeArrowSpecs: (
      edge: { arrows: 0 | 1 | 2; returnStart: 1 | 2 | null },
      a: 1,
      b: 2,
    ) => ArrowSpec[];
  }).edgeArrowSpecs(edge, 1, 2);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

describe('edge arrow placement', () => {
  it('uses the black player color for black arrows', () => {
    expect(renderer.DEFAULT_THEME.arrowOnBlack).toBe(renderer.DEFAULT_THEME.black);
  });

  it('places one arrow at the center of the destination-side half', () => {
    expect(arrowSpecs({ arrows: 1, returnStart: 2 })).toEqual([
      { from: 1, to: 2, frac: 0.75 },
    ]);
  });

  it('keeps both traversal arrows near their destinations when the edge closes', () => {
    expect(arrowSpecs({ arrows: 2, returnStart: 2 })).toEqual([
      { from: 1, to: 2, frac: 0.75 },
      { from: 2, to: 1, frac: 0.75 },
    ]);
  });
});

describe('closed edge visuals', () => {
  it('colors closed rails by owner so red and black closed paths are distinguishable', () => {
    const { redClosed, blackClosed } = renderer.DEFAULT_THEME;
    expect(redClosed).not.toBe(blackClosed);
    const [rR, rG, rB] = hexToRgb(redClosed);
    const [bR, bG, bB] = hexToRgb(blackClosed);
    // red closed is wine-red: the red channel dominates green and blue
    expect(rR).toBeGreaterThan(rG);
    expect(rR).toBeGreaterThan(rB);
    // black closed is darker than red closed, so the two read as different shades
    expect(relativeLuminance([bR, bG, bB])).toBeLessThan(relativeLuminance([rR, rG, rB]));
  });

  it('keeps the outward <> chevrons contrasting with each closed rail', () => {
    const { redClosed, arrowOnRedClosed, blackClosed, arrowOnBlackClosed } = renderer.DEFAULT_THEME;
    // dark chevron on the wine-red rail
    expect(relativeLuminance(hexToRgb(arrowOnRedClosed))).toBeLessThan(relativeLuminance(hexToRgb(redClosed)));
    // light chevron on the black rail (a dark chevron would vanish on black)
    expect(relativeLuminance(hexToRgb(arrowOnBlackClosed))).toBeGreaterThan(relativeLuminance(hexToRgb(blackClosed)));
  });
});

describe('terminal board feedback', () => {
  it('leaves both pieces unlettered and highlights only the final path', () => {
    const arc = vi.fn();
    const fillText = vi.fn();
    const setLineDash = vi.fn();
    const strokes: string[] = [];
    const context = new Proxy({
      arc, fillText, setLineDash, strokeStyle: '',
      stroke() { strokes.push(this.strokeStyle); },
    }, {
      get: (target, key, receiver) => Reflect.get(target, key, receiver) ?? (() => ({ addColorStop() {} })),
    }) as unknown as CanvasRenderingContext2D;
    const game = createGame(2, 9);

    renderer.renderBoard(context, { edges: game.edges, red: 2, black: 9 },
      { size: 420, padding: 50 }, renderer.BAMBOO_THEME, {
        engraved: true,
        pointLabels: { 1: '松', 2: '竹', 3: '梅', 4: '山', 5: '月', 6: '水', 7: '风', 8: '云', 9: '鹤' },
        effect: { kind: 'win', player: 'red', from: 1, point: 2, progress: 0.5 },
      });

    expect(fillText.mock.calls.map(([text]) => text)).toEqual(['松', '梅', '山', '月', '水', '风', '云']);
    expect(arc.mock.calls.map(([, , radius]) => radius)).toEqual([15, 15, 15, 15, 15, 15, 15, 16, 5, 16, 5]);
    expect(setLineDash).not.toHaveBeenCalled();
    expect(strokes.slice(-2)).toEqual(['#c99539', '#f9df91']);
  });
});
