import { describe, it, expect } from 'vitest';
import { createGame, clone } from '../src/state';
import { applyMove, gameResult, legalMoves } from '../src/rules';
import { bestMove, aiMove, analyzeMove, evaluate, DIFFICULTY_DEPTH, DIFFICULTY_NODES } from '../src/ai';
import { edgeIdBetween } from '../src/board';
import { GameState, Point, EdgeOwner } from '../src/types';

function setEdge(
  s: GameState,
  a: Point,
  b: Point,
  owner: EdgeOwner,
  arrows: 0 | 1 | 2,
  returnStart: Point | null,
) {
  s.edges[edgeIdBetween(a, b)] = { owner, arrows, returnStart };
}

describe('AI', () => {
  // Legal midgames independently solved to termination: each has one winning choice.
  const strategicFixtures = [
    { destinations: [2,6,4,8,1,5,4,6,2], winningTarget: 5 },
    { destinations: [2,6,5,9,3,8,5,6,1], winningTarget: 5 },
    { destinations: [2,8,5,9,1,6,4,2,1,6,5], winningTarget: 8 },
  ];
  it.each(strategicFixtures)('hard preserves the forced win in midgame $destinations', ({destinations, winningTarget}) => {
    let s = createGame(1,9);
    for (const to of destinations) s = applyMove(s, {player: s.turn, from: s.tokens[s.turn], to: to as Point});
    expect(aiMove(s, s.turn, 'hard')?.to).toBe(winningTarget);
  });
  it('finds a trap-in-1 winning move by occupying the opponent escape point', () => {
    // black@1, its only escape is 1->2 (1-4,1-5 red-claimed); red@3 can play 3->2 to block.
    const s = createGame(3, 1, 'red');
    setEdge(s, 1, 4, 'red', 1, 4);
    setEdge(s, 1, 5, 'red', 1, 5);
    expect(
      legalMoves({ ...s, turn: 'black' })
        .map((m) => m.to)
        .sort(),
    ).toEqual([2]);

    const m = bestMove(s, 3, 'red');
    expect(m).not.toBeNull();
    expect(m!.to).toBe(2);

    const s2 = applyMove(s, m!);
    const r = gameResult(s2);
    expect(r.over).toBe(true);
    if (r.over) expect(r.winner).toBe('red');
  });

  it('returns null when the player has no legal move', () => {
    const s = createGame(1, 9, 'red');
    setEdge(s, 1, 2, 'black', 1, 2);
    setEdge(s, 1, 4, 'black', 1, 4);
    setEdge(s, 1, 5, 'black', 1, 5);
    expect(bestMove(s, 3, 'red')).toBeNull();
  });

  it('evaluate favors the side with more mobility', () => {
    const s = createGame(5, 1, 'red'); // red@center vs black@corner
    expect(evaluate(s, 'red')).toBeGreaterThan(0);
    expect(evaluate(s, 'black')).toBeLessThan(0);
  });

  it('self-play always terminates within the 40-move bound', () => {
    let s = createGame(1, 9, 'red');
    let guard = 0;
    while (!gameResult(s).over && guard < 60) {
      const m = bestMove(s, 3, s.turn);
      if (!m) break;
      s = applyMove(s, m);
      guard += 1;
    }
    const r = gameResult(s);
    expect(r.over).toBe(true);
    expect(s.moveCount).toBeLessThanOrEqual(40);
  });

  it('difficulty presets increase in depth', () => {
    expect(DIFFICULTY_DEPTH.easy).toBeLessThan(DIFFICULTY_DEPTH.medium);
    expect(DIFFICULTY_DEPTH.medium).toBeLessThan(DIFFICULTY_DEPTH.hard);
  });

  it('stops at a deterministic node budget and preserves a legal completed result', () => {
    const s = createGame(1,9);
    const before = JSON.stringify(s);
    const options = {maxDepth: 20, nodeBudget: 120};
    const a = analyzeMove(s, options);
    expect(a.nodes).toBeLessThanOrEqual(120);
    expect(a.completedDepth).toBeGreaterThan(0);
    expect(a.completedDepth).toBeLessThan(20);
    expect(legalMoves(s)).toContainEqual(a.move);
    expect(analyzeMove(s,options)).toEqual(a);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('falls back legally when the budget cannot finish the first iteration', () => {
    const s = createGame(1,9);
    const a = analyzeMove(s,{maxDepth:10,nodeBudget:1});
    expect(a.completedDepth).toBe(0); expect(a.proven).toBe(false);
    expect(a.nodes).toBe(1); expect(legalMoves(s)).toContainEqual(a.move);
  });

  it('reports terminal proof and prefers the immediate win', () => {
    const s = createGame(3,1);
    setEdge(s,1,4,'red',1,4); setEdge(s,1,5,'red',1,5);
    const a = analyzeMove(s,{maxDepth:10,nodeBudget:1000});
    expect(a.move?.to).toBe(2); expect(a.proven).toBe(true);
    expect(a.completedDepth).toBe(1);
  });

  it('values accessible return paths instead of disconnected claimed paths', () => {
    const accessible = createGame(1,9);
    setEdge(accessible,1,2,'red',1,1);
    const blocked = clone(accessible);
    setEdge(blocked,1,2,'red',1,2);
    expect(evaluate(accessible,'red')).toBeGreaterThan(evaluate(blocked,'red'));
    expect(evaluate(accessible,'red')).toBe(-evaluate(accessible,'black'));
  });

  it('keeps the hard preset within its node limit on an open board', () => {
    const s = createGame(5,1);
    const a = analyzeMove(s,{maxDepth:DIFFICULTY_DEPTH.hard,nodeBudget:DIFFICULTY_NODES.hard});
    expect(a.nodes).toBeLessThanOrEqual(DIFFICULTY_NODES.hard);
    expect(legalMoves(s)).toContainEqual(a.move);
  });

  it('cached alpha-beta agrees with an independent exhaustive shallow search', () => {
    function exhaustive(s: GameState, depth: number, ply: number): number {
      const moves = legalMoves(s);
      if (!moves.length) return -100000 + ply;
      if (!depth) return evaluate(s,s.turn);
      return Math.max(...moves.map(m => -exhaustive(applyMove(s,m),depth-1,ply+1)));
    }
    let seed = 31;
    for (const start of [[1,9],[5,1],[2,8]] as const) {
      let s = createGame(start[0],start[1]);
      for (let ply = 0; ply < 8 && !gameResult(s).over; ply++) {
        if (ply % 2 === 0) expect(analyzeMove(s,{maxDepth:4}).score).toBe(exhaustive(s,4,0));
        seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
        const moves = legalMoves(s);
        s = applyMove(s,moves[seed % moves.length]);
      }
    }
  });
});
