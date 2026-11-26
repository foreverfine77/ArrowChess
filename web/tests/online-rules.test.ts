import { describe, expect, it } from 'vitest';
import { applyOnlineCommand, type RoomState } from '../../miniprogram/online-rules';
import { createGame, legalMoves, applyMove, gameResult } from '../../core/src/index';

function room(first: 'red' | 'black' = 'red'): RoomState {
  return {creator: 'r', creatorSide: 'red', opponent: 'b', status: 'playing', first,
    turn: 'red', phase: 'placing', placeStep: 0, edges: [], redPos: null, blackPos: null,
    initialRed: null, initialBlack: null, history: [], winner: null, revision: 1};
}
function placed(first: 'red' | 'black' = 'red'): RoomState {
  const red = applyOnlineCommand(room(first), 'r', {type: 'place', point: 1}, 1, 'red-place');
  return applyOnlineCommand(red, 'b', {type: 'place', point: 9}, 2, 'black-place');
}
describe('authoritative online transitions', () => {
  it('allows black placement after red, then honors the selected first player', () => {
    for (const first of ['red', 'black'] as const) {
      const r = placed(first);
      expect(r.phase).toBe('playing'); expect(r.turn).toBe(first);
      expect(r.edges).toEqual(createGame(1,9,first).edges);
    }
  });
  it('derives moved tokens and paths from the shared Core', () => {
    const r = placed(); const move = {player: 'red', from: 1, to: 2} as const;
    const next = applyOnlineCommand(r, 'r', {type: 'move', move}, 3, 'move-1');
    const expected = applyMove(createGame(1,9), move);
    expect(next.redPos).toBe(2); expect(next.edges).toEqual(expected.edges);
    expect(next.turn).toBe('black'); expect(next.history).toEqual([move]);
  });
  it('rejects illegal moves, nonparticipants, wrong turns and occupied placements', () => {
    const r = placed();
    expect(() => applyOnlineCommand(r, 'r', {type: 'move', move: {player:'red',from:1,to:9}}, 3, 'bad')).toThrow('非法');
    expect(() => applyOnlineCommand(r, 'outsider', {type:'place',point:2}, 3, 'bad')).toThrow('对局');
    expect(() => applyOnlineCommand(r, 'b', {type: 'move', move: {player:'black',from:9,to:8}}, 3, 'bad')).toThrow('轮到');
    const red = applyOnlineCommand(room(), 'r', {type:'place',point:1}, 1, 'red');
    expect(() => applyOnlineCommand(red, 'b', {type:'place',point:1}, 2, 'black')).toThrow('放置点');
  });
  it('rejects outdated versions and accepts duplicate request IDs without a second move', () => {
    const r = placed(); const command = {type:'move', move:{player:'red',from:1,to:2}} as const;
    const next = applyOnlineCommand(r, 'r', command, 3, 'move-1');
    expect(applyOnlineCommand(next, 'r', command, 3, 'move-1')).toBe(next);
    expect(() => applyOnlineCommand(next, 'r', command, 3, 'move-2')).toThrow('更新');
  });
  it('determines the winner and finished state from legal moves', () => {
    let r = placed(); let g = createGame(1,9); let sequence = 0;
    while (!gameResult(g).over) {
      const move = legalMoves(g)[0];
      r = applyOnlineCommand(r, move.player === 'red' ? 'r' : 'b', {type:'move',move}, r.revision, `move-${++sequence}`);
      g = applyMove(g, move);
    }
    const result = gameResult(g);
    expect(result.over).toBe(true);
    if (result.over) expect(r.winner).toBe(result.winner);
    expect(r.phase).toBe('over'); expect(r.status).toBe('finished');
  });
});
