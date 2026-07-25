/** 箭棋领域类型（纯内核，无 UI / 网络依赖）。术语见根 CONTEXT.md。 */

export type Player = 'red' | 'black';

export const RED: Player = 'red';
export const BLACK: Player = 'black';

export function opponent(p: Player): Player {
  return p === 'red' ? 'black' : 'red';
}

/** 棋盘点编号，1..9，行优先（1＝左上，9＝右下）。 */
export type Point = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const POINTS: readonly Point[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 两点之间的一条路径；规范形 a < b。 */
export interface Edge {
  id: number;
  a: Point;
  b: Point;
}

export type EdgeOwner = Player | null;

/** 路径状态：归属 + 箭头数 + 返回起点（见 ADR-0004）。 */
export interface EdgeState {
  owner: EdgeOwner;
  arrows: 0 | 1 | 2;
  /** 首次走过时抵达的端点；第 2 箭须从此点反向走出。未占领或已关闭时为 null。 */
  returnStart: Point | null;
}

/** 可序列化的走法 command（见 ADR-0002）。 */
export interface Move {
  player: Player;
  from: Point;
  to: Point;
}

export interface Tokens {
  red: Point;
  black: Point;
}

export interface GameState {
  tokens: Tokens;
  /** 20 条路径，按 Edge.id 下标索引。 */
  edges: EdgeState[];
  turn: Player;
  moveCount: number;
}

export type GameResult =
  | { over: false }
  | { over: true; winner: Player; loser: Player; reason: 'trapped' };
