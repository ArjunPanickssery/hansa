/**
 * Tests for map definitions and random map generation.
 */

import { describe, it, expect } from 'vitest';
import { tutorialMap } from '../maps/tutorial';
import { europeMap } from '../maps/europe';
import { generateRandomMap } from '../maps/random';
import { TERRAIN } from '../utils/terrain';
import { GOODS } from '../utils/economics';

function validateMap(mapData) {
  // Grid dimensions match declared size
  expect(mapData.grid.length).toBe(mapData.height);
  for (const row of mapData.grid) {
    expect(row.length).toBe(mapData.width);
  }

  // All terrain values are valid
  const validTerrains = new Set(Object.values(TERRAIN));
  for (let r = 0; r < mapData.height; r++) {
    for (let c = 0; c < mapData.width; c++) {
      expect(validTerrains.has(mapData.grid[r][c])).toBe(true);
    }
  }

  // Cities are within grid bounds
  for (const city of mapData.cities) {
    expect(city.row).toBeGreaterThanOrEqual(0);
    expect(city.row).toBeLessThan(mapData.height);
    expect(city.col).toBeGreaterThanOrEqual(0);
    expect(city.col).toBeLessThan(mapData.width);
  }

  // Cities are not placed on ocean
  for (const city of mapData.cities) {
    const terrain = mapData.grid[city.row][city.col];
    expect(terrain).not.toBe(TERRAIN.OCEAN);
  }

  // All cities have required fields
  for (const city of mapData.cities) {
    expect(typeof city.name).toBe('string');
    expect(city.name.length).toBeGreaterThan(0);
    expect(city.population).toBeGreaterThan(0);
    expect(typeof city.productionCosts).toBe('object');
    for (const good of GOODS) {
      expect(typeof city.productionCosts[good]).toBe('number');
      expect(city.productionCosts[good]).toBeGreaterThan(0);
    }
  }

  // City names are unique
  const names = mapData.cities.map(c => c.name);
  expect(new Set(names).size).toBe(names.length);
}

describe('tutorial map', () => {
  it('has valid structure', () => {
    validateMap(tutorialMap);
  });

  it('has 4 cities', () => {
    expect(tutorialMap.cities.length).toBe(4);
  });

  it('is a small map (20x15)', () => {
    expect(tutorialMap.width).toBe(20);
    expect(tutorialMap.height).toBe(15);
  });

  it('cities have differentiated production costs', () => {
    // Each city should be good at different things
    const cheapest = tutorialMap.cities.map(city => {
      let minCost = Infinity, minGood = null;
      for (const good of GOODS) {
        if (city.productionCosts[good] < minCost) {
          minCost = city.productionCosts[good];
          minGood = good;
        }
      }
      return minGood;
    });
    // At least 3 different "best goods" across 4 cities
    expect(new Set(cheapest).size).toBeGreaterThanOrEqual(3);
  });
});

describe('europe map', () => {
  it('has valid structure', () => {
    validateMap(europeMap);
  });

  it('has 18 cities', () => {
    expect(europeMap.cities.length).toBe(18);
  });

  it('is a 40x30 grid', () => {
    expect(europeMap.width).toBe(40);
    expect(europeMap.height).toBe(30);
  });

  it('includes key historical cities', () => {
    const names = europeMap.cities.map(c => c.name);
    expect(names).toContain('London');
    expect(names).toContain('Amsterdam');
    expect(names).toContain('Venice');
    expect(names).toContain('Constantinople');
    expect(names).toContain('Paris');
  });

  it('coastal cities are good at fish', () => {
    const lisbon = europeMap.cities.find(c => c.name === 'Lisbon');
    expect(lisbon).toBeTruthy();
    // Lisbon should have low fish cost (coastal)
    expect(lisbon.productionCosts.fish).toBeLessThanOrEqual(2);
  });

  it('inland cities have higher fish costs', () => {
    const vienna = europeMap.cities.find(c => c.name === 'Vienna');
    expect(vienna).toBeTruthy();
    expect(vienna.productionCosts.fish).toBeGreaterThan(4);
  });
});

describe('random map generation', () => {
  it('generates a valid map', () => {
    const map = generateRandomMap(40, 30, 12, 42);
    validateMap(map);
  });

  it('respects requested city count', () => {
    const map = generateRandomMap(40, 30, 8, 42);
    // Should have close to requested count (might be less if not enough space)
    expect(map.cities.length).toBeGreaterThanOrEqual(4);
    expect(map.cities.length).toBeLessThanOrEqual(10);
  });

  it('generates different maps with different seeds', () => {
    const map1 = generateRandomMap(30, 20, 8, 1);
    const map2 = generateRandomMap(30, 20, 8, 999);
    // Cities should be in different positions
    const pos1 = map1.cities.map(c => `${c.row},${c.col}`).sort().join(';');
    const pos2 = map2.cities.map(c => `${c.row},${c.col}`).sort().join(';');
    expect(pos1).not.toBe(pos2);
  });

  it('same seed produces same map', () => {
    const map1 = generateRandomMap(30, 20, 8, 42);
    const map2 = generateRandomMap(30, 20, 8, 42);
    expect(map1.cities.length).toBe(map2.cities.length);
    for (let i = 0; i < map1.cities.length; i++) {
      expect(map1.cities[i].row).toBe(map2.cities[i].row);
      expect(map1.cities[i].col).toBe(map2.cities[i].col);
    }
  });

  it('has a mix of terrain types', () => {
    const map = generateRandomMap(40, 30, 10, 42);
    const terrainTypes = new Set();
    for (const row of map.grid) {
      for (const cell of row) {
        terrainTypes.add(cell);
      }
    }
    // Should have at least ocean, plains, and one other
    expect(terrainTypes.has(TERRAIN.OCEAN)).toBe(true);
    expect(terrainTypes.has(TERRAIN.PLAINS)).toBe(true);
    expect(terrainTypes.size).toBeGreaterThanOrEqual(3);
  });

  it('cities have production costs influenced by terrain', () => {
    const map = generateRandomMap(40, 30, 10, 42);
    // Not all cities should have identical costs
    const costs = map.cities.map(c => JSON.stringify(c.productionCosts));
    const uniqueCosts = new Set(costs);
    expect(uniqueCosts.size).toBeGreaterThan(1);
  });

  it('handles small maps gracefully', () => {
    const map = generateRandomMap(10, 10, 4, 42);
    validateMap(map);
    expect(map.cities.length).toBeGreaterThanOrEqual(1);
  });

  it('auto-generates seed when none provided', () => {
    const map = generateRandomMap(20, 15, 6);
    expect(map.seed).toBeDefined();
    expect(typeof map.seed).toBe('number');
  });
});
