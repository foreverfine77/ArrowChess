import { describe, it, expect } from 'vitest';
import {
  EDGES,
  EDGE_COUNT,
  degree,
  neighbors,
  edgeIdBetween,
  tryEdgeIdBetween,
  adjacent,
} from '../src/board';

describe('board topology', () => {
  it('has 20 edges', () => {
    expect(EDGE_COUNT).toBe(20);
    expect(EDGES).toHaveLength(20);
  });

  it('corner degree 3, side-middle degree 5, center degree 8', () => {
    expect(degree(1)).toBe(3);
    expect(degree(3)).toBe(3);
    expect(degree(7)).toBe(3);
    expect(degree(9)).toBe(3);
    expect(degree(2)).toBe(5);
    expect(degree(4)).toBe(5);
    expect(degree(6)).toBe(5);
    expect(degree(8)).toBe(5);
    expect(degree(5)).toBe(8);
  });

  it('point 1 neighbors are 2,4,5', () => {
    const ns = neighbors(1)
      .map((r) => r.neighbor)
      .sort();
    expect(ns).toEqual([2, 4, 5]);
  });

  it('center 5 neighbors are all other points', () => {
    const ns = neighbors(5)
      .map((r) => r.neighbor)
      .sort();
    expect(ns).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
  });

  it('edgeIdBetween is symmetric; opposite corners not adjacent', () => {
    expect(edgeIdBetween(1, 5)).toBe(edgeIdBetween(5, 1));
    expect(tryEdgeIdBetween(1, 9)).toBe(-1);
    expect(() => edgeIdBetween(1, 9)).toThrow();
  });

  it('adjacency includes diagonals', () => {
    expect(adjacent(1, 5)).toBe(true);
    expect(adjacent(3, 5)).toBe(true);
    expect(adjacent(1, 2)).toBe(true);
    expect(adjacent(1, 9)).toBe(false);
  });
});
