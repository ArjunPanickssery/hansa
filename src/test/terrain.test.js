/**
 * Tests for terrain utilities.
 */

import { describe, it, expect } from 'vitest';
import { TERRAIN, TRANSPORT_COST, TERRAIN_COLORS, calcProductionCosts } from '../utils/terrain';

describe('TERRAIN constants', () => {
  it('has all expected terrain types', () => {
    expect(TERRAIN.OCEAN).toBe('ocean');
    expect(TERRAIN.COASTAL).toBe('coastal');
    expect(TERRAIN.RIVER).toBe('river');
    expect(TERRAIN.PLAINS).toBe('plains');
    expect(TERRAIN.FOREST).toBe('forest');
    expect(TERRAIN.MOUNTAIN).toBe('mountain');
  });

  it('every terrain type has a transport cost', () => {
    for (const type of Object.values(TERRAIN)) {
      expect(TRANSPORT_COST[type]).toBeDefined();
      expect(TRANSPORT_COST[type]).toBeGreaterThan(0);
    }
  });

  it('every terrain type has a color', () => {
    for (const type of Object.values(TERRAIN)) {
      expect(TERRAIN_COLORS[type]).toBeDefined();
      expect(typeof TERRAIN_COLORS[type]).toBe('string');
    }
  });
});

describe('calcProductionCosts', () => {
  it('returns costs for all 4 goods', () => {
    const costs = calcProductionCosts([TERRAIN.PLAINS, TERRAIN.PLAINS]);
    expect(costs.wheat).toBeDefined();
    expect(costs.fish).toBeDefined();
    expect(costs.iron).toBeDefined();
    expect(costs.silk).toBeDefined();
  });

  it('all costs are positive', () => {
    const costs = calcProductionCosts([TERRAIN.PLAINS]);
    for (const good of Object.values(costs)) {
      expect(good).toBeGreaterThan(0);
    }
  });

  it('coastal terrain reduces fish cost', () => {
    const coastal = calcProductionCosts([TERRAIN.COASTAL, TERRAIN.COASTAL, TERRAIN.OCEAN]);
    const inland = calcProductionCosts([TERRAIN.PLAINS, TERRAIN.PLAINS, TERRAIN.PLAINS]);
    expect(coastal.fish).toBeLessThan(inland.fish);
  });

  it('mountain terrain reduces iron cost', () => {
    const mountain = calcProductionCosts([TERRAIN.MOUNTAIN, TERRAIN.MOUNTAIN]);
    const plains = calcProductionCosts([TERRAIN.PLAINS, TERRAIN.PLAINS]);
    expect(mountain.iron).toBeLessThan(plains.iron);
  });

  it('forest terrain reduces silk cost', () => {
    const forest = calcProductionCosts([TERRAIN.FOREST, TERRAIN.FOREST]);
    const plains = calcProductionCosts([TERRAIN.PLAINS, TERRAIN.PLAINS]);
    expect(forest.silk).toBeLessThan(plains.silk);
  });

  it('plains terrain reduces wheat cost', () => {
    const plains = calcProductionCosts([TERRAIN.PLAINS, TERRAIN.PLAINS, TERRAIN.PLAINS]);
    const forest = calcProductionCosts([TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST]);
    expect(plains.wheat).toBeLessThan(forest.wheat);
  });

  it('no terrain gives high default costs', () => {
    const costs = calcProductionCosts([]);
    // Without any terrain bonuses, all goods should be expensive
    expect(costs.wheat).toBeGreaterThanOrEqual(4);
    expect(costs.fish).toBeGreaterThanOrEqual(4);
    expect(costs.iron).toBeGreaterThanOrEqual(4);
    expect(costs.silk).toBeGreaterThanOrEqual(4);
  });

  it('costs never go below 1', () => {
    // Even with many bonus tiles, cost should be >= 1
    const lotsOfBonus = Array(20).fill(TERRAIN.PLAINS);
    const costs = calcProductionCosts(lotsOfBonus);
    for (const good of Object.values(costs)) {
      expect(good).toBeGreaterThanOrEqual(1);
    }
  });
});
