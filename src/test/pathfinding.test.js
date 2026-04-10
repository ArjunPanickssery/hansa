/**
 * Tests for pathfinding / transport cost calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { findPathCost, getTransportCost, clearPathCache } from '../utils/pathfinding';
import { TERRAIN, TRANSPORT_COST } from '../utils/terrain';

beforeEach(() => {
  clearPathCache();
});

describe('findPathCost', () => {
  it('returns 0 for same start and end', () => {
    const grid = [
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
    ];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 0, col: 0 });
    expect(cost).toBe(0);
  });

  it('finds path through plains', () => {
    const grid = [
      [TERRAIN.PLAINS, TERRAIN.PLAINS, TERRAIN.PLAINS],
    ];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
    // Two steps through plains at cost 5 each
    expect(cost).toBe(TRANSPORT_COST[TERRAIN.PLAINS] * 2);
  });

  it('prefers ocean over land routes', () => {
    // A grid where direct path is through mountains, but a longer water path exists
    const P = TERRAIN.PLAINS;
    const O = TERRAIN.OCEAN;
    const M = TERRAIN.MOUNTAIN;
    const grid = [
      [O, O, O, O, O],
      [P, M, M, M, P],
      [P, P, P, P, P],
    ];
    const landCost = findPathCost(grid, { row: 1, col: 0 }, { row: 1, col: 4 });
    // There should be a path; through mountains direct would be 4*15=60
    // Through row 0 (ocean): 1 step to ocean + 4 ocean + 1 step back = cheaper
    expect(Number.isFinite(landCost)).toBe(true);
    expect(landCost).toBeLessThan(60); // should find the cheaper route
  });

  it('ocean tiles have cost 1', () => {
    const grid = [
      [TERRAIN.OCEAN, TERRAIN.OCEAN, TERRAIN.OCEAN],
    ];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
    expect(cost).toBe(2); // 2 ocean steps at cost 1 each
  });

  it('mountain tiles have cost 15', () => {
    const grid = [
      [TERRAIN.MOUNTAIN, TERRAIN.MOUNTAIN, TERRAIN.MOUNTAIN],
    ];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
    expect(cost).toBe(30);
  });

  it('returns Infinity for unreachable target', () => {
    // This shouldn't happen on real maps, but test the edge case
    // A 1x1 grid where start != end is impossible
    const grid = [[TERRAIN.PLAINS]];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 5, col: 5 });
    expect(cost).toBe(Infinity);
  });

  it('diagonal moves cost sqrt(2) times the tile cost', () => {
    const grid = [
      [TERRAIN.OCEAN, TERRAIN.OCEAN],
      [TERRAIN.OCEAN, TERRAIN.OCEAN],
    ];
    const cost = findPathCost(grid, { row: 0, col: 0 }, { row: 1, col: 1 });
    // Diagonal: 1 * 1.41
    expect(cost).toBeCloseTo(1.41, 1);
  });
});

describe('getTransportCost (with cache)', () => {
  it('returns same value as findPathCost', () => {
    const grid = [
      [TERRAIN.PLAINS, TERRAIN.PLAINS, TERRAIN.PLAINS],
      [TERRAIN.PLAINS, TERRAIN.PLAINS, TERRAIN.PLAINS],
    ];
    const a = { row: 0, col: 0 };
    const b = { row: 1, col: 2 };
    const direct = findPathCost(grid, a, b);
    const cached = getTransportCost(grid, a, b);
    expect(cached).toBe(direct);
  });

  it('returns cached value on second call', () => {
    const grid = [
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
    ];
    const a = { row: 0, col: 0 };
    const b = { row: 1, col: 1 };
    const first = getTransportCost(grid, a, b);
    const second = getTransportCost(grid, a, b);
    expect(second).toBe(first);
  });

  it('cache works in reverse direction', () => {
    const grid = [
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
      [TERRAIN.PLAINS, TERRAIN.PLAINS],
    ];
    const a = { row: 0, col: 0 };
    const b = { row: 1, col: 1 };
    const forward = getTransportCost(grid, a, b);
    const reverse = getTransportCost(grid, b, a);
    expect(reverse).toBe(forward);
  });
});

describe('transport cost ordering', () => {
  it('ocean < river < plains < forest < mountain', () => {
    expect(TRANSPORT_COST[TERRAIN.OCEAN]).toBeLessThan(TRANSPORT_COST[TERRAIN.RIVER]);
    expect(TRANSPORT_COST[TERRAIN.RIVER]).toBeLessThan(TRANSPORT_COST[TERRAIN.PLAINS]);
    expect(TRANSPORT_COST[TERRAIN.PLAINS]).toBeLessThan(TRANSPORT_COST[TERRAIN.FOREST]);
    expect(TRANSPORT_COST[TERRAIN.FOREST]).toBeLessThan(TRANSPORT_COST[TERRAIN.MOUNTAIN]);
  });
});
