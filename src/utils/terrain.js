/**
 * Terrain types and their properties.
 */

export const TERRAIN = {
  OCEAN: 'ocean',
  COASTAL: 'coastal',
  RIVER: 'river',
  PLAINS: 'plains',
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
};

// Transport cost per tile
export const TRANSPORT_COST = {
  [TERRAIN.OCEAN]: 1,
  [TERRAIN.COASTAL]: 1,
  [TERRAIN.RIVER]: 2,
  [TERRAIN.PLAINS]: 5,
  [TERRAIN.FOREST]: 8,
  [TERRAIN.MOUNTAIN]: 15,
};

// Colors for rendering — muted cartographic palette
export const TERRAIN_COLORS = {
  [TERRAIN.OCEAN]: '#4a7a9b',
  [TERRAIN.COASTAL]: '#7ab5d4',
  [TERRAIN.RIVER]: '#6aaac8',
  [TERRAIN.PLAINS]: '#b8c98a',
  [TERRAIN.FOREST]: '#6b8e5a',
  [TERRAIN.MOUNTAIN]: '#a89e8e',
};

// Production cost modifiers based on surrounding terrain.
// Lower = cheaper to produce. Cities get bonuses from nearby terrain.
export const TERRAIN_PRODUCTION_BONUS = {
  [TERRAIN.COASTAL]: { fish: 0.5 },
  [TERRAIN.OCEAN]: { fish: 0.3 },
  [TERRAIN.RIVER]: { fish: 0.3 },
  [TERRAIN.PLAINS]: { wheat: 0.5 },
  [TERRAIN.FOREST]: { wood: 0.3, silk: 0.5 },
  [TERRAIN.MOUNTAIN]: { iron: 0.5 },
};

/**
 * Calculate production costs for a city based on surrounding terrain.
 * Base costs are modified downward by nearby terrain bonuses.
 */
export function calcProductionCosts(surroundingTerrain) {
  // Base costs (labor per unit)
  const costs = {
    wheat: 4,
    fish: 4,
    iron: 4,
    silk: 4,
  };

  // Count terrain types in surrounding cells
  const terrainCounts = {};
  for (const t of surroundingTerrain) {
    terrainCounts[t] = (terrainCounts[t] || 0) + 1;
  }

  // Apply bonuses
  for (const [terrain, bonuses] of Object.entries(TERRAIN_PRODUCTION_BONUS)) {
    const count = terrainCounts[terrain] || 0;
    if (count > 0) {
      for (const [good, bonus] of Object.entries(bonuses)) {
        if (costs[good] !== undefined) {
          // Each adjacent matching terrain tile reduces cost
          costs[good] = Math.max(1, costs[good] - bonus * count);
        }
      }
    }
  }

  // Cities on ocean can't exist, coastal cities must be near water
  // If no relevant terrain, mark some goods as very expensive
  const hasCoastal = (terrainCounts[TERRAIN.COASTAL] || 0) + (terrainCounts[TERRAIN.OCEAN] || 0) + (terrainCounts[TERRAIN.RIVER] || 0);
  if (hasCoastal === 0) {
    costs.fish = 12; // Very expensive without water
  }

  const hasMountain = terrainCounts[TERRAIN.MOUNTAIN] || 0;
  if (hasMountain === 0) {
    costs.iron = 8; // More expensive without mountains
  }

  const hasForest = terrainCounts[TERRAIN.FOREST] || 0;
  if (hasForest === 0) {
    costs.silk = 8; // More expensive without forest
  }

  const hasPlains = terrainCounts[TERRAIN.PLAINS] || 0;
  if (hasPlains === 0) {
    costs.wheat = 8; // More expensive without plains
  }

  return costs;
}
