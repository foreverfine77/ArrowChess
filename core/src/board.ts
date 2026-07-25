import { Edge, Point, POINTS } from './types';

function rowOf(p: Point): number {
  return Math.floor((p - 1) / 3);
}
function colOf(p: Point): number {
  return (p - 1) % 3;
}

/** 王步相邻（横 / 竖 / 斜八方向），不含自身。 */
export function adjacent(a: Point, b: Point): boolean {
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return Math.max(dr, dc) === 1;
}

function buildEdges(): Edge[] {
  const edges: Edge[] = [];
  let id = 0;
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      if (adjacent(a as Point, b as Point)) {
        edges.push({ id, a: a as Point, b: b as Point });
        id += 1;
      }
    }
  }
  return edges;
}

export const EDGES: readonly Edge[] = buildEdges();
export const EDGE_COUNT: number = EDGES.length;

export interface NeighborRef {
  neighbor: Point;
  edgeId: number;
}

const ADJACENCY: NeighborRef[][] = POINTS.map(() => [] as NeighborRef[]);

for (const e of EDGES) {
  ADJACENCY[e.a - 1].push({ neighbor: e.b, edgeId: e.id });
  ADJACENCY[e.b - 1].push({ neighbor: e.a, edgeId: e.id });
}

export function neighbors(p: Point): readonly NeighborRef[] {
  return ADJACENCY[p - 1];
}

export function degree(p: Point): number {
  return ADJACENCY[p - 1].length;
}

/** 两点间路径的下标，不相邻返回 -1。 */
export function tryEdgeIdBetween(a: Point, b: Point): number {
  for (const ref of ADJACENCY[a - 1]) {
    if (ref.neighbor === b) return ref.edgeId;
  }
  return -1;
}

export function edgeIdBetween(a: Point, b: Point): number {
  const id = tryEdgeIdBetween(a, b);
  if (id === -1) throw new Error(`No edge between ${a} and ${b}`);
  return id;
}
