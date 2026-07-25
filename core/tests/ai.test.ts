import { describe, it, expect } from 'vitest';
import { createGame } from '../src/state';
import { applyMove, gameResult, legalMoves } from '../src/rules';
import { bestMove, evaluate, DIFFICULTY_DEPTH } from '../src/ai';
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
});
