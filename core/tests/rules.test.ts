import { describe, it, expect } from 'vitest';
import { createGame, serialize, deserialize } from '../src/state';
import { legalMoves, isLegal, applyMove, gameResult } from '../src/rules';
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

describe('legal moves & claiming', () => {
  it('fresh game: red at corner 1 has 3 legal moves (2,4,5)', () => {
    const s = createGame(1, 9, 'red');
    const moves = legalMoves(s)
      .map((m) => m.to)
      .sort();
    expect(moves).toEqual([2, 4, 5]);
  });

  it('no-landing: cannot move onto opponent point', () => {
    const s = createGame(1, 2, 'red'); // red@1, black@2 adjacent
    const moves = legalMoves(s)
      .map((m) => m.to)
      .sort();
    expect(moves).toEqual([4, 5]); // 2 blocked by black
  });

  it('claiming a fresh edge sets owner/arrows/returnStart; original state unchanged', () => {
    const s = createGame(1, 9, 'red');
    const s2 = applyMove(s, { player: 'red', from: 1, to: 5 });
    expect(s2.edges[edgeIdBetween(1, 5)]).toEqual({ owner: 'red', arrows: 1, returnStart: 5 });
    expect(s2.tokens.red).toBe(5);
    expect(s2.turn).toBe('black');
    expect(s2.moveCount).toBe(1);
    expect(s.edges[edgeIdBetween(1, 5)].arrows).toBe(0); // immutable
  });
});

describe('reverse return (ADR-0004)', () => {
  it('owner may reverse-return from returnStart, closing the edge', () => {
    const s = createGame(1, 9, 'red');
    setEdge(s, 1, 5, 'red', 1, 5);
    s.tokens.red = 5; // red at arrival endpoint
    expect(isLegal(s, { player: 'red', from: 5, to: 1 })).toBe(true);
    const s2 = applyMove(s, { player: 'red', from: 5, to: 1 });
    expect(s2.edges[edgeIdBetween(1, 5)]).toEqual({ owner: 'red', arrows: 2, returnStart: 5 });
    expect(s2.tokens.red).toBe(1);
  });

  it('same-direction reuse is NOT legal', () => {
    const s = createGame(1, 9, 'red');
    setEdge(s, 1, 5, 'red', 1, 5);
    s.tokens.red = 1; // red at the non-returnStart endpoint
    expect(isLegal(s, { player: 'red', from: 1, to: 5 })).toBe(false);
  });

  it('opponent cannot traverse a claimed edge', () => {
    const s = createGame(9, 5, 'black'); // red@9, black@5, black turn
    setEdge(s, 1, 5, 'red', 1, 5); // red owns 1-5; destination 1 is not red@9
    expect(isLegal(s, { player: 'black', from: 5, to: 1 })).toBe(false);
  });

  it('closed edge (arrows=2) cannot be traversed by owner either direction', () => {
    const s = createGame(1, 9, 'red');
    setEdge(s, 1, 5, 'red', 2, 5);
    s.tokens.red = 1;
    expect(isLegal(s, { player: 'red', from: 1, to: 5 })).toBe(false);
    s.tokens.red = 5;
    expect(isLegal(s, { player: 'red', from: 5, to: 1 })).toBe(false);
  });
});

describe('win detection', () => {
  it('trapped player loses', () => {
    const s = createGame(1, 9, 'red'); // red@1, red turn
    setEdge(s, 1, 2, 'black', 1, 2);
    setEdge(s, 1, 4, 'black', 1, 4);
    setEdge(s, 1, 5, 'black', 1, 5);
    expect(legalMoves(s)).toHaveLength(0);
    const r = gameResult(s);
    expect(r.over).toBe(true);
    if (r.over) {
      expect(r.winner).toBe('black');
      expect(r.loser).toBe('red');
      expect(r.reason).toBe('trapped');
    }
  });

  it('ongoing game is not over', () => {
    expect(gameResult(createGame(1, 9, 'red')).over).toBe(false);
  });
});

describe('serialization', () => {
  it('round-trips a state', () => {
    const s = applyMove(createGame(1, 9, 'red'), { player: 'red', from: 1, to: 5 });
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });
});
