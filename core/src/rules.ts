import { EdgeState, GameResult, GameState, Move, Player, Point, opponent } from './types';
import { neighbors, tryEdgeIdBetween } from './board';
import { clone } from './state';

/** 己方能否从 from 走过该路径（不含「落点是否为对方点」的检查）。 */
function canTraverse(edge: EdgeState, player: Player, from: Point): boolean {
  if (edge.arrows === 0) return true; // 未占领 -> 占领
  if (edge.owner !== player) return false; // 对方路径，不可走
  if (edge.arrows === 2) return false; // 已关闭
  // arrows === 1：仅允许从返回起点反向返回（ADR-0004）
  return from === edge.returnStart;
}

export function isLegal(state: GameState, move: Move): boolean {
  if (move.player !== state.turn) return false;
  if (state.tokens[move.player] !== move.from) return false;
  if (move.to === state.tokens[opponent(move.player)]) return false; // 不可落在对方点（ADR-0001）
  const eid = tryEdgeIdBetween(move.from, move.to);
  if (eid === -1) return false;
  return canTraverse(state.edges[eid], move.player, move.from);
}

export function legalMoves(state: GameState): Move[] {
  const player = state.turn;
  const from = state.tokens[player];
  const oppPos = state.tokens[opponent(player)];
  const moves: Move[] = [];
  for (const ref of neighbors(from)) {
    const to = ref.neighbor;
    if (to === oppPos) continue; // 不可落在对方点
    if (canTraverse(state.edges[ref.edgeId], player, from)) {
      moves.push({ player, from, to });
    }
  }
  return moves;
}

/** 执行走法（假定合法）。返回新状态，不改原状态。 */
export function applyMove(state: GameState, move: Move): GameState {
  const next = clone(state);
  const eid = tryEdgeIdBetween(move.from, move.to);
  if (eid === -1) {
    throw new Error(`非法走法（不相邻）: ${move.player} ${move.from}->${move.to}`);
  }
  const e = next.edges[eid];
  if (e.arrows === 0) {
    e.owner = move.player;
    e.arrows = 1;
    e.returnStart = move.to; // 抵达端点
  } else if (e.owner === move.player && e.arrows === 1 && move.from === e.returnStart) {
    e.arrows = 2; // 反向返回 -> 关闭
  } else {
    throw new Error(`非法走法: ${move.player} ${move.from}->${move.to}`);
  }
  next.tokens[move.player] = move.to;
  next.turn = opponent(move.player);
  next.moveCount += 1;
  return next;
}

export function gameResult(state: GameState): GameResult {
  if (legalMoves(state).length === 0) {
    const loser = state.turn;
    return { over: true, winner: opponent(loser), loser, reason: 'trapped' };
  }
  return { over: false };
}
