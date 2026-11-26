import {
  createGame,
  applyMove,
  legalMoves,
  isLegal,
  gameResult,
  aiMove,
  bestMove,
  opponent,
  emptyEdge,
  edgeIdBetween,
} from '../../core/src/index';
import type { GameState, Move, Player, Point, Difficulty } from '../../core/src/index';
import { EDGE_COUNT, POINTS } from '../../core/src/index';
import { renderBoard, pointXY, type BoardEffect, type BoardView, type Layout, type RenderOpts } from './renderer';
import { playSound, soundEnabled, toggleSound } from './sound';
import { boardTheme } from './theme';
import brushUrl from './brush.ttf';
import mingUrl from './ming.ttf';
import { enhanceSelectMenus } from './select-menus';

type Mode = '2p' | 'ai';
type Phase = 'placing' | 'playing' | 'over';

interface AppState {
  mode: Mode;
  difficulty: Difficulty;
  humanSide: Player; // 人机模式：人类执方
  first: Player;
  phase: Phase;
  placeStep: 0 | 1; // 0=放置红，1=放置黑
  red: Point | null;
  black: Point | null;
  game: GameState | null;
  initialGame: GameState | null;
  history: Move[];
  stack: GameState[]; // 悔棋用：每步前的状态快照
  selected: Point | null;
  lastMove: Move | null;
  hint: Move | null;
  replayIdx: number; // -1=实时
  aiPending: boolean;
}

const SIZE = 420;
const LAYOUT: Layout = { size: SIZE, padding: 50 };
const POINT_LABELS: Readonly<Record<Point, string>> = {
  1: '风', 2: '山', 3: '松',
  4: '云', 5: '月', 6: '竹',
  7: '鹤', 8: '水', 9: '梅',
};
const THEME_KEY = 'arrow-chess-theme';
let inkTheme = false;
try { inkTheme = localStorage.getItem(THEME_KEY) === 'ink'; } catch { /* optional storage */ }

const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const elPoints = document.getElementById('points')!;
const elArena = document.getElementById('arena')!;
const elPlayers = { red: document.getElementById('redPlayer')!, black: document.getElementById('blackPlayer')! };
const elRoles = { red: document.getElementById('redRole')!, black: document.getElementById('blackRole')! };
const elTurnCount = document.getElementById('turnCount')!;
const elDetail = document.getElementById('statusDetail')!;
const elHistoryCount = document.getElementById('historyCount')!;
const elHistoryEmpty = document.getElementById('historyEmpty')!;
const elHistoryPanel = document.getElementById('historyPanel') as HTMLDetailsElement;
const elSound = document.getElementById('sound')!;
const elTheme = document.getElementById('theme')!;
const elThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let effect: RenderOpts['effect'];
let animationFrame = 0;
let invalidPoint: Point | null = null;

function resizeBoard(): void {
  const width = canvas.getBoundingClientRect().width || SIZE;
  const pixels = Math.round(width * Math.min(window.devicePixelRatio || 1, 3));
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  ctx.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
  render();
}

function clearEffect(): void {
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  effect = undefined;
}

function feedback(next: BoardEffect): void {
  clearEffect();
  playSound(next.kind);
  if (reducedMotion.matches || document.hidden || state.replayIdx >= 0) return;
  const started = performance.now();
  const duration = next.kind === 'win' ? 680 : 340;
  const frame = (now: number) => {
    const progress = Math.max(0, (now - started) / duration);
    effect = progress < 1 ? { ...next, progress } : undefined;
    animationFrame = effect ? window.requestAnimationFrame(frame) : 0;
    render();
  };
  frame(started);
}

const elMode = document.getElementById('mode') as HTMLSelectElement;
const elHumanSide = document.getElementById('humanSide') as HTMLSelectElement;
const elDifficulty = document.getElementById('difficulty') as HTMLSelectElement;
const elFirst = document.getElementById('first') as HTMLSelectElement;
const syncSettings = enhanceSelectMenus([elMode, elFirst, elHumanSide, elDifficulty]);
const elStatus = document.getElementById('status')!;
const elMovelist = document.getElementById('movelist')!;
const elReplayInfo = document.getElementById('replayInfo')!;
const elUndo = document.getElementById('undo') as HTMLButtonElement;
const elHint = document.getElementById('hint') as HTMLButtonElement;
const elStepBack = document.getElementById('stepBack') as HTMLButtonElement;
const elStepFwd = document.getElementById('stepFwd') as HTMLButtonElement;
const elToLive = document.getElementById('toLive') as HTMLButtonElement;

const state: AppState = {
  mode: elMode.value as Mode,
  difficulty: elDifficulty.value as Difficulty,
  humanSide: elHumanSide.value as Player,
  first: elFirst.value as Player,
  phase: 'placing',
  placeStep: 0,
  red: null,
  black: null,
  game: null,
  initialGame: null,
  history: [],
  stack: [],
  selected: null,
  lastMove: null,
  hint: null,
  replayIdx: -1,
  aiPending: false,
};

function aiPlayer(): Player {
  return opponent(state.humanSide);
}

function emptyEdges(): EdgeStateLike[] {
  return Array.from({ length: EDGE_COUNT }, () => emptyEdge());
}
type EdgeStateLike = ReturnType<typeof emptyEdge>;

function currentView(): { view: BoardView; live: GameState | null } {
  if (state.phase === 'placing' || !state.game) {
    return { view: { edges: emptyEdges(), red: state.red, black: state.black }, live: null };
  }
  if (state.replayIdx >= 0 && state.initialGame) {
    let s = state.initialGame;
    for (let i = 0; i <= state.replayIdx && i < state.history.length; i++) {
      s = applyMove(s, state.history[i]);
    }
    return { view: { edges: s.edges, red: s.tokens.red, black: s.tokens.black }, live: s };
  }
  const g = state.game;
  return { view: { edges: g.edges, red: g.tokens.red, black: g.tokens.black }, live: g };
}

function render(): void {
  const { view, live } = currentView();
  const opts: RenderOpts = { engraved: true, pointLabels: POINT_LABELS, effect: state.replayIdx < 0 ? effect : undefined };

  if (state.phase === 'placing') {
    opts.placement = { next: state.placeStep === 0 ? 'red' : 'black' };
  } else if (live) {
    opts.selected = state.selected;
    opts.lastMove = state.replayIdx >= 0 ? state.history[state.replayIdx] ?? null : state.lastMove;
    opts.hint = state.replayIdx < 0 ? state.hint : null;
    const humanTurn =
      state.phase === 'playing' &&
      state.replayIdx < 0 &&
      !(state.mode === 'ai' && live.turn === aiPlayer());
    if (humanTurn) {
      opts.legalTargets = legalMoves(live).map((m) => m.to);
    }
  }
  ctx.clearRect(0, 0, SIZE, SIZE);
  renderBoard(ctx, view, LAYOUT, boardTheme(inkTheme), opts);
}

const sideName = { red: '红方', black: '黑方' };

function updateBoardStatus(): void {
  const { view, live } = currentView();
  const placing = state.phase === 'placing';
  const replaying = state.replayIdx >= 0;
  const over = !replaying && state.phase === 'over' && live ? gameResult(live) : null;
  const active = placing ? (state.placeStep === 0 ? 'red' : 'black') : live?.turn;
  const thinking = state.mode === 'ai' && active === aiPlayer();
  const options = !placing && !replaying && !over && !thinking && live ? legalMoves(live) : [];
  for (const side of ['red', 'black'] as const) {
    elPlayers[side].classList.toggle('active', replaying ? false : over?.over ? side === over.winner : side === active);
    elRoles[side].textContent = state.mode === 'ai' ? (side === state.humanSide ? '你' : 'AI') : '';
    elRoles[side].hidden = state.mode !== 'ai';
  }
  elArena.classList.toggle('finished', !!over?.over);
  elTurnCount.textContent = placing ? `放置 ${state.placeStep + 1} / 2`
    : replaying ? `回放 ${state.replayIdx + 1} / ${state.history.length}`
    : over?.over ? '终局' : `第 ${state.history.length + 1} 手`;
  elStatus.textContent = replaying ? `回放第 ${state.replayIdx + 1} 手`
    : placing && active ? `请放置${sideName[active]}棋子`
    : over?.over ? `${sideName[over.winner]}胜`
    : active && thinking ? `AI（${sideName[active]}）思考中…`
    : active && state.mode === 'ai' ? `轮到你（${sideName[active]}）`
    : active ? `轮到${sideName[active]}` : '';
  elDetail.textContent = replaying ? '可从棋谱选择走法，或返回实况。'
    : over?.over ? `${sideName[over.loser]}无路可走。`
    : invalidPoint ? `「${POINT_LABELS[invalidPoint]}」${placing ? '已有棋子' : '当前不可落子'}。`
    : placing ? '选择棋盘上的一个空点。'
    : thinking ? '等待电脑落子。'
    : state.hint ? `建议从「${POINT_LABELS[state.hint.from]}」移到「${POINT_LABELS[state.hint.to]}」。`
    : `${options.length} 个可走落点，已在棋盘上标亮。`;

  pointButtons.forEach((button, index) => {
    const point = POINTS[index];
    const hasToken = point === view.red || point === view.black;
    const legal = options.some(move => move.to === point) || (placing && !hasToken);
    const label = point === view.red ? '红方棋子' : point === view.black ? '黑方棋子'
      : point === state.hint?.to ? '提示落点' : legal ? '可落子' : '空点';
    button.setAttribute('aria-label', `${POINT_LABELS[point]}，${label}`);
  });
}

function updateStatus(): void {
  updateBoardStatus();
  document.body.classList.toggle('ai', state.mode === 'ai');
  const inPlay = state.phase === 'playing' || state.phase === 'over';
  elHumanSide.disabled = state.phase !== 'placing';
  elFirst.disabled = state.phase !== 'placing';
  syncSettings();
  elUndo.disabled = !inPlay || !canUndo();
  elHint.disabled = state.replayIdx >= 0 || state.phase !== 'playing' || (state.mode === 'ai' && state.game?.turn === aiPlayer());
  elStepBack.disabled = state.history.length === 0;
  elStepFwd.disabled = state.replayIdx < 0;
  elToLive.disabled = state.replayIdx < 0;
  elReplayInfo.textContent =
    state.replayIdx >= 0 ? `回放中（步 ${state.replayIdx + 1}/${state.history.length}）` : '';
  elHistoryCount.textContent = `${state.history.length} 手`;
  elHistoryEmpty.hidden = state.history.length > 0;
  while (elMovelist.children.length > state.history.length) elMovelist.lastElementChild?.remove();
  const previousCount = elMovelist.children.length;
  state.history.slice(previousCount).forEach((m, offset) => {
    const i = previousCount + offset;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-move';
    button.innerHTML = `<span class="move-number">${i + 1}</span><span class="move-side ${m.player}">${sideName[m.player]}</span><span class="move-path">${POINT_LABELS[m.from]} → ${POINT_LABELS[m.to]}</span>`;
    button.setAttribute('aria-label', `第 ${i + 1} 手，${sideName[m.player]}，从${POINT_LABELS[m.from]}到${POINT_LABELS[m.to]}`);
    button.addEventListener('click', () => {
      clearEffect();
      state.replayIdx = i;
      state.hint = null;
      invalidPoint = null;
      render();
      updateStatus();
    });
    li.appendChild(button);
    elMovelist.appendChild(li);
  });
  Array.from(elMovelist.children).forEach((li, i) => {
    const button = li.firstElementChild!;
    if (i === state.replayIdx) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  if (state.replayIdx < 0 && state.history.length > previousCount) elMovelist.scrollTop = elMovelist.scrollHeight;
}

let aiTimer: ReturnType<typeof setTimeout> | null = null;
let sessionGeneration = 0;
function cancelAI(): void {
  sessionGeneration++;
  if (aiTimer !== null) clearTimeout(aiTimer);
  aiTimer = null; state.aiPending = false;
}

function scheduleAI(): void {
  if (state.mode !== 'ai' || !state.game || state.phase !== 'playing') return;
  if (state.game.turn !== aiPlayer()) return;
  if (state.aiPending) return;
  state.aiPending = true;
  const generation = sessionGeneration;
  aiTimer = setTimeout(() => {
    if (generation !== sessionGeneration) return;
    aiTimer = null;
    state.aiPending = false;
    if (state.mode !== 'ai' || !state.game || state.phase !== 'playing' || state.game.turn !== aiPlayer()) return;
    const m = aiMove(state.game, aiPlayer(), state.difficulty);
    if (m) doMove(m);
  }, 320);
}

function doMove(move: Move): boolean {
  if (!state.game || !isLegal(state.game, move)) return false;
  state.stack.push(state.game);
  state.game = applyMove(state.game, move);
  state.history.push(move);
  state.lastMove = move;
  state.selected = null;
  state.hint = null;
  invalidPoint = null;
  const res = gameResult(state.game);
  state.phase = res.over ? 'over' : 'playing';
  const closed = state.game.edges[edgeIdBetween(move.from, move.to)].arrows === 2;
  feedback({ point: move.to, from: move.from, player: move.player, kind: res.over ? 'win' : closed ? 'close' : 'claim' });
  if (state.phase === 'playing') scheduleAI();
  render();
  updateStatus();
  return true;
}

function rejectPoint(point: Point): void {
  invalidPoint = point;
  feedback({ point, kind: 'invalid' });
  updateBoardStatus();
}

function handleClick(p: Point): void {
  if (state.phase === 'placing') {
    placeToken(p);
    return;
  }
  if (state.replayIdx >= 0) {
    toLive();
    return;
  }
  if (!state.game || state.phase !== 'playing') return;
  if (state.mode === 'ai' && state.game.turn === aiPlayer()) return; // AI 回合

  const g = state.game;
  const legal = legalMoves(g);
  const target = legal.find((m) => m.to === p);
  if (target) {
    doMove(target);
    return;
  }
  if (p === g.tokens[g.turn]) {
    invalidPoint = null;
    state.selected = state.selected === p ? null : p;
    state.hint = null;
  } else {
    state.selected = null;
    rejectPoint(p);
  }
  render();
  updateStatus();
}

function placeToken(p: Point): void {
  const player = state.placeStep === 0 ? 'red' : 'black';
  if (p === state.red || p === state.black) {
    rejectPoint(p);
    return;
  }
  invalidPoint = null;
  if (state.placeStep === 0) {
    state.red = p;
    state.placeStep = 1;
  } else {
    state.black = p;
    state.game = createGame(state.red!, state.black!, state.first);
    state.initialGame = state.game;
    state.phase = 'playing';
    state.history = [];
    state.stack = [];
    state.lastMove = null;
    state.selected = null;
    state.hint = null;
    state.replayIdx = -1;
    if (state.mode === 'ai' && state.game.turn === aiPlayer()) scheduleAI();
  }
  feedback({ point: p, player, kind: 'place' });
  render();
  updateStatus();
}

function undo(): void {
  if (!canUndo()) return;
  cancelAI();
  clearEffect();
  invalidPoint = null;
  playSound('control');
  do {
    state.game = state.stack.pop()!;
    state.history.pop();
  } while (state.mode === 'ai' && state.game.turn !== state.humanSide && state.stack.length > 0);
  state.lastMove = state.history.length > 0 ? state.history[state.history.length - 1] : null;
  state.phase = 'playing';
  state.selected = null;
  state.hint = null;
  state.replayIdx = -1;
  render();
  updateStatus();
}

function canUndo(): boolean {
  return !state.aiPending && state.phase !== 'placing' && !!state.game && state.stack.length > 0 &&
    (state.mode !== 'ai' || state.stack.some(g => g.turn === state.humanSide));
}

function showHint(): void {
  if (state.replayIdx >= 0) return;
  if (state.phase !== 'playing' || !state.game) return;
  if (state.mode === 'ai' && state.game.turn === aiPlayer()) return;
  const m = bestMove(state.game, 4, state.game.turn);
  invalidPoint = null;
  state.hint = m;
  state.selected = null;
  if (m) feedback({ point: m.to, kind: 'hint' });
  render();
  updateStatus();
}

function stepBack(): void {
  if (state.history.length === 0) return;
  clearEffect();
  invalidPoint = null;
  state.hint = null;
  if (state.replayIdx < 0) state.replayIdx = state.history.length - 1;
  else state.replayIdx = Math.max(0, state.replayIdx - 1);
  render();
  updateStatus();
}

function stepFwd(): void {
  if (state.replayIdx < 0) return;
  state.replayIdx++;
  if (state.replayIdx >= state.history.length) state.replayIdx = -1;
  render();
  updateStatus();
}

function toLive(): void {
  state.replayIdx = -1;
  render();
  updateStatus();
}

function newGame(): void {
  cancelAI();
  clearEffect();
  invalidPoint = null;
  state.phase = 'placing';
  state.placeStep = 0;
  state.red = null;
  state.black = null;
  state.game = null;
  state.initialGame = null;
  state.history = [];
  state.stack = [];
  state.selected = null;
  state.lastMove = null;
  state.hint = null;
  state.replayIdx = -1;
  state.aiPending = false;
  render();
  updateStatus();
}

const pointButtons = POINTS.map((point, index) => {
  const button = document.createElement('button');
  const position = pointXY(LAYOUT, point);
  button.type = 'button';
  button.className = 'point';
  button.style.left = `${position.x / SIZE * 100}%`;
  button.style.top = `${position.y / SIZE * 100}%`;
  button.tabIndex = index === 0 ? 0 : -1;
  button.addEventListener('focus', () => {
    pointButtons.forEach((other) => { other.tabIndex = other === button ? 0 : -1; });
  });
  button.addEventListener('click', () => handleClick(point));
  button.addEventListener('keydown', (event) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    let next = index;
    switch (event.key) {
      case 'ArrowLeft': if (col > 0) next--; break;
      case 'ArrowRight': if (col < 2) next++; break;
      case 'ArrowUp': if (row > 0) next -= 3; break;
      case 'ArrowDown': if (row < 2) next += 3; break;
      default: return;
    }
    event.preventDefault();
    pointButtons[next].focus();
  });
  elPoints.appendChild(button);
  return button;
});

function updateSoundButton(): void {
  const enabled = soundEnabled();
  elSound.setAttribute('aria-pressed', String(enabled));
  elSound.title = enabled ? '关闭音效' : '开启音效';
}

function updateTheme(): void {
  document.body.dataset.theme = inkTheme ? 'ink' : 'bamboo';
  elTheme.setAttribute('aria-pressed', String(inkTheme));
  elTheme.title = inkTheme ? '切换到竹青主题' : '切换到墨夜主题';
  if (elThemeColor) elThemeColor.content = inkTheme ? '#192820' : '#eeefe5';
}

elMode.addEventListener('change', () => {
  state.mode = elMode.value as Mode;
  newGame();
});
elHumanSide.addEventListener('change', () => {
  state.humanSide = elHumanSide.value as Player;
  updateStatus();
});
elDifficulty.addEventListener('change', () => {
  state.difficulty = elDifficulty.value as Difficulty;
});
elFirst.addEventListener('change', () => {
  state.first = elFirst.value as Player;
});
document.getElementById('newGame')!.addEventListener('click', () => {
  playSound('control');
  newGame();
});
document.getElementById('undo')!.addEventListener('click', undo);
document.getElementById('hint')!.addEventListener('click', showHint);
document.getElementById('stepBack')!.addEventListener('click', stepBack);
document.getElementById('stepFwd')!.addEventListener('click', stepFwd);
document.getElementById('toLive')!.addEventListener('click', toLive);
elSound.addEventListener('click', () => {
  toggleSound();
  updateSoundButton();
});
elTheme.addEventListener('click', () => {
  inkTheme = !inkTheme;
  try { localStorage.setItem(THEME_KEY, inkTheme ? 'ink' : 'bamboo'); } catch { /* optional storage */ }
  updateTheme();
  render();
});
elHistoryPanel.addEventListener('toggle', () => {
  if (elHistoryPanel.open && state.replayIdx < 0) elMovelist.scrollTop = elMovelist.scrollHeight;
});

window.addEventListener('resize', resizeBoard);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeBoard).observe(canvas);
reducedMotion.addEventListener?.('change', () => { clearEffect(); render(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearEffect(); render(); }
});
updateTheme();
resizeBoard();
updateSoundButton();
updateStatus();

if (typeof FontFace !== 'undefined' && document.fonts) {
  const brush = new FontFace('Arrow Brush', `url("${brushUrl}")`);
  document.fonts.add(brush);
  void brush.load().then(render).catch(() => {});
  const ming = new FontFace('Arrow Ming', `url("${mingUrl}")`, { weight: '200 900' });
  document.fonts.add(ming);
  void ming.load().catch(() => {});
}
