/**
 * 平台无关的箭棋渲染层（见 ADR-0002：纯内核 + 外壳分离）。
 * 目标是 Canvas2D-like context，浏览器与微信小程序 Canvas 2d 共用同一份。
 * 不获取 canvas、不读 DOM--由调用方传入 ctx。
 */
import { EDGES } from './core-bridge';
import type { EdgeState, Move, Player, Point } from './core-bridge';

export interface Theme {
  bg: string;
  edge: string; // 未占领路径
  red: string;
  black: string;
  pointFill: string;
  pointStroke: string;
  legal: string; // 合法落点高亮
  selected: string; // 选中棋子
  lastMove: string;
  hint: string;
  text: string;
  arrowOnRed: string;
  arrowOnBlack: string;
  redClosed: string;
  blackClosed: string;
  arrowOnRedClosed: string;
  arrowOnBlackClosed: string;
  paper?: { light: string; dark: string; border: string };
}

export const DEFAULT_THEME: Theme = {
  bg: '#e7e9df',
  edge: '#9da59d',
  red: '#c83d35',
  black: '#262a2c',
  pointFill: '#f7f8f4',
  pointStroke: '#59635c',
  legal: '#4f7b58',
  selected: '#d58f17',
  lastMove: '#d58f17',
  hint: '#267eb5',
  text: '#272d29',
  arrowOnRed: '#751f1a',
  arrowOnBlack: '#262a2c',
  redClosed: '#7a1f1a',
  blackClosed: '#262a2c',
  arrowOnRedClosed: '#1d2220',
  arrowOnBlackClosed: '#cfd2cc',
};

/**
 * 竹青水墨主题 —— 见《箭棋 UI 设计规范 竹青水墨版》。
 * 以竹青色系为主调，朱砂红为唯一高饱和点缀，方正低饱和。
 */
export const BAMBOO_THEME: Theme = {
  bg: '#E9ECDF',         // board-surface 棋盘卡片底色
  edge: '#9FAB8A',       // line-neutral 未占用路径
  red: '#B23A2A',        // vermilion 朱砂红
  black: '#333B2A',      // ink 墨色（偏绿）
  pointFill: '#EEF0E4',  // 落点填充
  pointStroke: '#5F6A4C',// 落点描边
  legal: '#7A8B5E',      // 合法落点高亮（竹青系偏深）
  selected: '#B23A2A',   // 选中棋子用朱砂
  lastMove: '#C68B5C',   // 上一手高亮（暖竹黄）
  hint: '#5C8A78',       // 提示箭头色（竹青偏蓝绿）
  text: '#333B2A',       // 主文字用墨色
  arrowOnRed: '#7A281E', // 红方路径上的箭头（深红）
  arrowOnBlack: '#333B2A', // 黑方路径上的箭头（同墨色）
  // 封闭路径统一用 path-closed 竹青灰，规范要求封闭后"哑掉"不区分归属
  redClosed: '#AAB196',
  blackClosed: '#AAB196',
  arrowOnRedClosed: '#7A8B66',
  arrowOnBlackClosed: '#7A8B66',
};

export interface Layout {
  size: number; // 画布逻辑边长（CSS px）
  padding: number;
}

export function pointXY(layout: Layout, p: Point): { x: number; y: number } {
  const row = Math.floor((p - 1) / 3);
  const col = (p - 1) % 3;
  const span = layout.size - layout.padding * 2;
  return {
    x: layout.padding + (col * span) / 2,
    y: layout.padding + (row * span) / 2,
  };
}

/**
 * 棋盘圆角半径 = padding。
 * 四个角的落点圆圈（点 1/3/7/9）与棋盘圆角同圆心，视觉上一气呵成。
 */
export function boardCornerRadius(layout: Layout): number {
  return layout.padding;
}

/** 渲染输入：边状态 + 双方棋子位置（放置阶段可为 null）。 */
export interface BoardView {
  edges: readonly EdgeState[];
  red: Point | null;
  black: Point | null;
}

export interface RenderOpts {
  selected?: Point | null;
  legalTargets?: readonly Point[];
  lastMove?: Move | null;
  hint?: Move | null;
  /** 放置阶段：高亮空点、标示下一个要放的方。 */
  placement?: { next: Player } | null;
  invalid?: Point | null;
  engraved?: boolean;
  pointLabels?: Readonly<Record<Point, string>>;
  effect?: BoardEffect & { progress: number };
}

export interface BoardEffect {
  point: Point;
  from?: Point;
  player?: Player;
  kind: 'place' | 'claim' | 'close' | 'hint' | 'invalid' | 'win';
}

type Ctx = CanvasRenderingContext2D;

function chevron(
  ctx: Ctx,
  ax: number, ay: number,
  bx: number, by: number,
  frac: number,
  color: string,
  size: number,
): void {
  const px = ax + (bx - ax) * frac;
  const py = ay + (by - ay) * frac;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // 三角形顶点指向 (bx,by) 方向
  const tipX = px + ux * size;
  const tipY = py + uy * size;
  const baseX = px - ux * size;
  const baseY = py - uy * size;
  const nx = -uy;
  const ny = ux;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX + nx * size * 0.7, baseY + ny * size * 0.7);
  ctx.lineTo(baseX - nx * size * 0.7, baseY - ny * size * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export interface EdgeArrowSpec {
  from: Point;
  to: Point;
  frac: number;
}

/** Each traversal keeps its arrow in the center of the destination-side half. */
export function edgeArrowSpecs(e: EdgeState, a: Point, b: Point): EdgeArrowSpec[] {
  if (e.arrows === 0 || e.returnStart == null) return [];
  const firstTo = e.returnStart;
  const firstFrom = firstTo === a ? b : a;
  const specs: EdgeArrowSpec[] = [{ from: firstFrom, to: firstTo, frac: 0.75 }];
  if (e.arrows === 2) {
    specs.push({ from: firstTo, to: firstFrom, frac: 0.75 });
  }
  return specs;
}

function drawEdge(
  ctx: Ctx,
  layout: Layout,
  theme: Theme,
  e: EdgeState,
  a: Point,
  b: Point,
): void {
  const pa = pointXY(layout, a);
  const pb = pointXY(layout, b);
  const owner = e.owner;
  if (e.arrows === 0) {
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = 1.5;
  } else if (e.arrows === 1) {
    ctx.strokeStyle = owner === 'red' ? theme.red : theme.black;
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = owner === 'red' ? theme.redClosed : theme.blackClosed;
    ctx.lineWidth = 6;
  }
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();

  for (const spec of edgeArrowSpecs(e, a, b)) {
    const from = pointXY(layout, spec.from);
    const to = pointXY(layout, spec.to);
    const color = e.arrows === 2
      ? (owner === 'red' ? theme.arrowOnRedClosed : theme.arrowOnBlackClosed)
      : owner === 'red' ? theme.arrowOnRed : theme.arrowOnBlack;
    chevron(ctx, from.x, from.y, to.x, to.y, spec.frac, color, 8);
  }
}

function drawPoint(
  ctx: Ctx,
  layout: Layout,
  theme: Theme,
  p: Point,
  opts: { highlight?: string; radius?: number; engraved?: boolean; label?: string } = {},
): void {
  const { x, y } = pointXY(layout, p);
  const r = opts.radius ?? 13;
  if (opts.highlight) {
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = opts.highlight;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.pointFill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = opts.highlight ?? theme.pointStroke;
  ctx.stroke();
  if (opts.engraved) {
    ctx.font = opts.label ? '400 17px "Arrow Brush", "Kaiti SC", KaiTi, serif' : '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.text;
    ctx.fillText(opts.label ?? String(p), x, y + 0.5);
  }
}

function drawToken(
  ctx: Ctx,
  layout: Layout,
  theme: Theme,
  p: Point,
  player: Player,
  selected: boolean,
  opts: RenderOpts,
): void {
  const dest = pointXY(layout, p);
  let { x, y } = dest;
  const effect = opts.effect;
  if (effect?.from && effect.point === p && effect.player === player) {
    const from = pointXY(layout, effect.from);
    const travel = 1 - (1 - Math.min(1, effect.progress * 2.5)) ** 3;
    x = from.x + (dest.x - from.x) * travel;
    y = from.y + (dest.y - from.y) * travel;
  }
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = theme.selected;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const grad = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, 16);
  const base = player === 'red' ? theme.red : theme.black;
  grad.addColorStop(0, player === 'red' ? '#e26a5e' : '#5a5a5a');
  grad.addColorStop(1, base);
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = player === 'red' ? '#fbe3df' : '#cfcfcf';
  ctx.fill();
}

function drawBoardEffect(ctx: Ctx, layout: Layout, theme: Theme, effect: NonNullable<RenderOpts['effect']>): void {
  const { point, player, kind, progress } = effect;
  const { x, y } = pointXY(layout, point);
  if (kind === 'win') {
    if (!effect.from) return;
    const from = pointXY(layout, effect.from);
    const dx = x - from.x;
    const dy = y - from.y;
    const inset = Math.min(0.3, 21 / Math.hypot(dx, dy));
    const fade = Math.sin(Math.PI * progress);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x + dx * inset, from.y + dy * inset);
    ctx.lineTo(x - dx * inset, y - dy * inset);
    ctx.strokeStyle = '#c99539';
    ctx.lineWidth = 11;
    ctx.globalAlpha = fade * 0.35;
    ctx.stroke();
    ctx.strokeStyle = '#f9df91';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = fade;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const color = kind === 'hint' ? theme.hint
    : kind === 'close' ? theme.lastMove : player === 'black' ? theme.black : theme.red;
  const wave = effect.from ? Math.max(0, (progress - 0.22) / 0.78) : progress;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = (1 - wave) * 0.8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 18 + wave * 14, 0, Math.PI * 2);
  ctx.stroke();
  if (kind === 'close') {
    ctx.globalAlpha = (1 - wave) * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 15 + wave * 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderBoard(
  ctx: Ctx,
  view: BoardView,
  layout: Layout,
  theme: Theme = DEFAULT_THEME,
  opts: RenderOpts = {},
): void {
  const r = boardCornerRadius(layout);
  // 圆角背景
  ctx.save();
  roundRectPath(ctx, 0, 0, layout.size, layout.size, r);
  ctx.fillStyle = theme.bg;
  ctx.fill();
  // 裁剪，确保路径/棋子都不超出圆角
  ctx.clip();

  if (opts.engraved) {
    const glow = ctx.createRadialGradient(layout.size * 0.38, layout.size * 0.3, 0,
      layout.size * 0.5, layout.size * 0.5, layout.size * 0.66);
    glow.addColorStop(0, theme.paper?.light ?? '#f3f2de');
    glow.addColorStop(1, theme.paper?.dark ?? '#dce1c9');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, layout.size, layout.size);
    ctx.strokeStyle = theme.paper?.border ?? '#92a17d42';
    ctx.lineWidth = 1;
    const inset = layout.padding * 0.32;
    roundRectPath(ctx, inset, inset, layout.size - inset * 2, layout.size - inset * 2, r - inset);
    ctx.stroke();
  }

  // 上一手先画成底衬，再由路径颜色覆盖，避免混淆归属。
  if (opts.lastMove) {
    const pa = pointXY(layout, opts.lastMove.from);
    const pb = pointXY(layout, opts.lastMove.to);
    ctx.strokeStyle = theme.lastMove;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 路径
  for (const ed of EDGES) {
    drawEdge(ctx, layout, theme, view.edges[ed.id], ed.a, ed.b);
  }

  // 提示高亮
  if (opts.hint) {
    const pa = pointXY(layout, opts.hint.from);
    const pb = pointXY(layout, opts.hint.to);
    ctx.strokeStyle = theme.hint;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    chevron(ctx, pa.x, pa.y, pb.x, pb.y, 0.75, theme.hint, 8);
  }

  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Point[]) {
    if (p === view.red || p === view.black) continue;
    const highlight = p === opts.hint?.to ? theme.hint
      : opts.placement || opts.legalTargets?.includes(p) ? theme.legal : undefined;
    const label = opts.pointLabels?.[p];
    drawPoint(ctx, layout, theme, p, { highlight, label, engraved: opts.engraved, radius: label ? 15 : opts.placement ? 11 : 13 });
  }
  // 棋子
  if (view.red) drawToken(ctx, layout, theme, view.red, 'red', opts.selected === view.red, opts);
  if (view.black) drawToken(ctx, layout, theme, view.black, 'black', opts.selected === view.black, opts);


  if (opts.invalid) drawBoardEffect(ctx, layout, theme, { point: opts.invalid, kind: 'invalid', progress: 0.25 });
  if (opts.effect) drawBoardEffect(ctx, layout, theme, opts.effect);
  ctx.restore();
}

/** 圆角矩形路径（兼容 Canvas 2D + 小程序 Canvas）。 */
function roundRectPath(
  ctx: Ctx,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}
