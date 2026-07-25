/**
 * 箭棋 AI：极小极大 + alpha-beta，基于纯内核（见 ADR-0002）。
 * 与公平性求解器同源；难度档对应搜索深度。
 */
import { GameState, Move, Player, opponent } from './types';
import { legalMoves, applyMove } from './rules';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 6,
};

const INF = 1e6;

/** 启发式评估：己方可落点数 - 对方可落点数。正值利于 player。 */
export function evaluate(state: GameState, player: Player): number {
  const mine = legalMoves({ ...state, turn: player }).length;
  const theirs = legalMoves({ ...state, turn: opponent(player) }).length;
  return mine - theirs;
}

function search(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  player: Player,
  ply: number,
): number {
  const moves = legalMoves(state);
  if (moves.length === 0) {
    // 当前轮到的方无路可走：player 被困为负，对方被困为正。
    // 越快取胜（ply 小）/越慢落败（ply 大）越优。
    return state.turn === player ? -INF + ply : INF - ply;
  }
  if (depth === 0) return evaluate(state, player);

  if (state.turn === player) {
    let best = -Infinity;
    for (const m of moves) {
      const v = search(applyMove(state, m), depth - 1, alpha, beta, player, ply + 1);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    const v = search(applyMove(state, m), depth - 1, alpha, beta, player, ply + 1);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

/** 返回当前轮到方（须为 player）的最佳走法；无走法返回 null。确定性。 */
export function bestMove(state: GameState, depth: number, player: Player): Move | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  const d = Math.max(1, depth);
  let best = -Infinity;
  let chosen: Move = moves[0];
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const v = search(applyMove(state, m), d - 1, alpha, beta, player, 1);
    if (v > best) {
      best = v;
      chosen = m;
    }
    if (best > alpha) alpha = best;
  }
  return chosen;
}

/** 按难度档选择走法。 */
export function aiMove(
  state: GameState,
  player: Player,
  difficulty: Difficulty = 'medium',
): Move | null {
  return bestMove(state, DIFFICULTY_DEPTH[difficulty], player);
}
