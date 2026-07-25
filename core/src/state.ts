import { EdgeState, GameState, Player, Point } from './types';
import { EDGE_COUNT } from './board';

export function emptyEdge(): EdgeState {
  return { owner: null, arrows: 0, returnStart: null };
}

export function createGame(
  redStart: Point,
  blackStart: Point,
  first: Player = 'red',
): GameState {
  if (redStart === blackStart) {
    throw new Error('双方棋子不能同点起始');
  }
  return {
    tokens: { red: redStart, black: blackStart },
    edges: Array.from({ length: EDGE_COUNT }, () => emptyEdge()),
    turn: first,
    moveCount: 0,
  };
}

export function clone(state: GameState): GameState {
  return {
    tokens: { ...state.tokens },
    edges: state.edges.map((e) => ({ ...e })),
    turn: state.turn,
    moveCount: state.moveCount,
  };
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (!s.edges || s.edges.length !== EDGE_COUNT) {
    throw new Error(`Invalid state: expected ${EDGE_COUNT} edges, got ${s.edges?.length}`);
  }
  return s;
}
