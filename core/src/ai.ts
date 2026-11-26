/** Deterministic, bounded alpha-beta search over the shared rule engine. */
import { GameState, Move, Player, Point, opponent } from './types';
import { legalMoves, applyMove } from './rules';
import { neighbors } from './board';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTY_DEPTH: Record<Difficulty, number> = { easy: 2, medium: 6, hard: 10 };
export const DIFFICULTY_NODES: Record<Difficulty, number> = { easy: 2000, medium: 6000, hard: 12000 };
const MATE = 100000;

interface Routes { mobility: number; capacity: number; points: number }
function routes(state: GameState, player: Player): Routes {
  const blocked = state.tokens[opponent(player)];
  const queue: Point[] = [state.tokens[player]];
  let points = 1 << (queue[0] - 1);
  let paths = 0;
  let capacity = 0;
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const ref of neighbors(from)) {
      const edge = state.edges[ref.edgeId];
      if (ref.neighbor === blocked || edge.arrows === 2 ||
        (edge.arrows === 1 && (edge.owner !== player || edge.returnStart !== from))) continue;
      const pathBit = 1 << ref.edgeId;
      if (!(paths & pathBit)) { paths |= pathBit; capacity += 2 - edge.arrows; }
      const pointBit = 1 << (ref.neighbor - 1);
      if (!(points & pointBit)) { points |= pointBit; queue.push(ref.neighbor); }
    }
  }
  return {mobility: legalMoves({...state, turn: player}).length, capacity, points: queue.length};
}
function routeScore(r: Routes): number {
  const forced = r.mobility === 0 ? -48 : r.mobility === 1 ? -16 : 0;
  return r.mobility * 16 + r.capacity * 2 + r.points * 3 + forced;
}
/** Reachable paths respect ownership, return direction and the occupied opposing point.
 * This estimates future options; it does not claim every reachable path can be used.
 */
export function evaluate(state: GameState, player: Player): number {
  return routeScore(routes(state, player)) - routeScore(routes(state, opponent(player)));
}

type Bound = 'exact' | 'lower' | 'upper';
interface Entry { depth: number; score: number; bound: Bound; to: Point | null }
interface SearchContext { nodes: number; budget: number; table: Map<string, Entry> }
class SearchLimit extends Error {}

/** Include returnStart: arrows and ownership alone do not describe legal returns. */
function positionKey(state: GameState): string {
  let key = `${state.tokens.red}${state.tokens.black}${state.turn === 'red' ? 'r' : 'b'}`;
  for (const edge of state.edges) {
    const code = edge.arrows === 0 ? 0 : edge.arrows === 2 ? 19 :
      (edge.owner === 'red' ? 0 : 9) + (edge.returnStart || 0);
    key += String.fromCharCode(65 + code);
  }
  return key;
}
interface Child { move: Move; state: GameState; moves: Move[]; priority: number }
function orderedChildren(state: GameState, moves: Move[], preferred?: Point | null): Child[] {
  return moves.map(move => {
    const next = applyMove(state, move);
    const nextMoves = legalMoves(next);
    const enemyMobility = nextMoves.length;
    const myMobility = legalMoves({...next, turn: state.turn}).length;
    const priority = (move.to === preferred ? 10000 : 0) +
      (enemyMobility === 0 ? 1000000 : 0) + myMobility * 4 - enemyMobility * 6;
    return {move, state: next, moves: nextMoves, priority};
  }).sort((a, b) => b.priority - a.priority || a.move.to - b.move.to);
}

function search(state: GameState, depth: number, alpha: number, beta: number,
  ply: number, context: SearchContext, moves = legalMoves(state)): number {
  if (context.nodes >= context.budget) throw new SearchLimit();
  context.nodes++;
  if (!moves.length) return -MATE + ply;
  if (depth === 0) return evaluate(state, state.turn);
  const key = positionKey(state);
  const cached = context.table.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.bound === 'exact' || (cached.bound === 'lower' && cached.score >= beta) ||
      (cached.bound === 'upper' && cached.score <= alpha)) return cached.score;
  }
  const originalAlpha = alpha;
  let score = -Infinity;
  let to: Point | null = null;
  for (const child of orderedChildren(state, moves, cached?.to)) {
    const value = -search(child.state, depth - 1, -beta, -alpha, ply + 1, context, child.moves);
    if (value > score) { score = value; to = child.move.to; }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  context.table.set(key, {depth, score, to,
    bound: score <= originalAlpha ? 'upper' : score >= beta ? 'lower' : 'exact'});
  return score;
}

export interface SearchOptions { maxDepth: number; nodeBudget?: number }
export interface SearchAnalysis {
  move: Move | null;
  score: number;
  completedDepth: number;
  nodes: number;
  /** True only when terminal results prove a win/loss, rather than heuristic scoring. */
  proven: boolean;
}

/** Iterative deepening preserves the last completed result when the budget runs out.
 * Caches belong to this call, so the pure Core stays deterministic and reproducible.
 */
export function analyzeMove(state: GameState, options: SearchOptions): SearchAnalysis {
  const moves = legalMoves(state);
  if (!moves.length) return {move: null, score: -MATE, completedDepth: 0, nodes: 0, proven: true};
  const remaining = state.edges.reduce((sum, edge) => sum + 2 - edge.arrows, 0);
  const maxDepth = Math.min(remaining, Math.max(1, Number.isFinite(options.maxDepth) ? Math.floor(options.maxDepth) : 1));
  const budget = options.nodeBudget === undefined ? Infinity :
    Math.max(1, Number.isFinite(options.nodeBudget) ? Math.floor(options.nodeBudget) : 1);
  const context: SearchContext = {nodes: 0, budget, table: new Map()};
  const fallback = orderedChildren(state, moves)[0];
  let result: SearchAnalysis = {move: fallback.move, score: evaluate(fallback.state, state.turn),
    completedDepth: 0, nodes: 0, proven: false};
  for (let depth = 1; depth <= maxDepth; depth++) {
    let score = -Infinity;
    let move = fallback.move;
    let alpha = -Infinity;
    try {
      for (const child of orderedChildren(state, moves, result.move?.to)) {
        const value = -search(child.state, depth - 1, -Infinity, -alpha, 1, context, child.moves);
        if (value > score) { score = value; move = child.move; }
        alpha = Math.max(alpha, score);
      }
    } catch (error) {
      if (!(error instanceof SearchLimit)) throw error;
      break;
    }
    result = {move, score, completedDepth: depth, nodes: context.nodes, proven: Math.abs(score) > MATE / 2};
    if (result.proven) break;
  }
  return {...result, nodes: context.nodes};
}

/** Fixed-depth, deterministic API used by hints and tactical analysis. */
export function bestMove(state: GameState, depth: number, player: Player): Move | null {
  if (player !== state.turn) throw new Error('AI 只能搜索当前回合的走法');
  return analyzeMove(state, {maxDepth: depth}).move;
}

export function aiMove(state: GameState, player: Player, difficulty: Difficulty = 'medium'): Move | null {
  if (player !== state.turn) throw new Error('AI 只能搜索当前回合的走法');
  return analyzeMove(state, {maxDepth: DIFFICULTY_DEPTH[difficulty], nodeBudget: DIFFICULTY_NODES[difficulty]}).move;
}
