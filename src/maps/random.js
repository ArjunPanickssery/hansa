/**
 * Random map generator using simplex-like noise.
 * Generates terrain and places cities at reasonable locations.
 */

import { TERRAIN } from '../utils/terrain';

// Simple hash-based noise (no dependency needed)
function hash(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash(ix, iy, seed);
  const n10 = hash(ix + 1, iy, seed);
  const n01 = hash(ix, iy + 1, seed);
  const n11 = hash(ix + 1, iy + 1, seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

function fractalNoise(x, y, seed, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

/**
 * Generate a random map.
 * @param {number} width - grid columns
 * @param {number} height - grid rows
 * @param {number} numCities - number of cities to place
 * @param {number} [seed] - random seed
 */
export function generateRandomMap(width = 40, height = 30, numCities = 12, seed = null) {
  if (seed === null) seed = Math.floor(Math.random() * 100000);

  const grid = Array.from({ length: height }, () => Array(width).fill(TERRAIN.OCEAN));

  // Generate elevation map
  const elevation = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => {
      // Create island-like shape: lower elevation near edges
      const cx = width / 2, cy = height / 2;
      const dx = (c - cx) / (width / 2);
      const dy = (r - cy) / (height / 2);
      const edgeDist = 1 - Math.sqrt(dx * dx + dy * dy);
      const edgeFactor = Math.max(0, edgeDist);

      const noise = fractalNoise(c / 8, r / 8, seed);
      return noise * 0.6 + edgeFactor * 0.4;
    })
  );

  // Moisture map for determining forest vs plains
  const moisture = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) =>
      fractalNoise(c / 6, r / 6, seed + 5000)
    )
  );

  // Convert elevation to terrain
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const e = elevation[r][c];
      const m = moisture[r][c];

      if (e < 0.3) {
        grid[r][c] = TERRAIN.OCEAN;
      } else if (e < 0.35) {
        grid[r][c] = TERRAIN.COASTAL;
      } else if (e > 0.7) {
        grid[r][c] = TERRAIN.MOUNTAIN;
      } else if (m > 0.55 && e < 0.55) {
        grid[r][c] = TERRAIN.FOREST;
      } else {
        grid[r][c] = TERRAIN.PLAINS;
      }
    }
  }

  // Add rivers: start from high elevation, flow downhill
  const riverCount = Math.floor(numCities / 3) + 1;
  for (let i = 0; i < riverCount; i++) {
    // Find a mountain/high tile to start
    let sr, sc;
    for (let attempt = 0; attempt < 100; attempt++) {
      sr = Math.floor(hash(i, attempt, seed + 9000) * height);
      sc = Math.floor(hash(attempt, i, seed + 9001) * width);
      if (elevation[sr][sc] > 0.6) break;
    }

    // Flow downhill
    let r = sr, c = sc;
    for (let step = 0; step < 30; step++) {
      if (r < 0 || r >= height || c < 0 || c >= width) break;
      if (grid[r][c] === TERRAIN.OCEAN || grid[r][c] === TERRAIN.COASTAL) break;

      grid[r][c] = TERRAIN.RIVER;

      // Find lowest neighbor
      let minE = elevation[r][c];
      let nr = r, nc = c;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < height && cc >= 0 && cc < width && elevation[rr][cc] < minE) {
          minE = elevation[rr][cc];
          nr = rr;
          nc = cc;
        }
      }
      if (nr === r && nc === c) {
        // Add some randomness if stuck
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const d = dirs[Math.floor(hash(r, c + step, seed + 8000) * 4)];
        nr = r + d[0];
        nc = c + d[1];
      }
      r = nr;
      c = nc;
    }
  }

  // Place cities on land tiles, preferring coastal and river adjacency
  const landTiles = [];
  for (let r = 2; r < height - 2; r++) {
    for (let c = 2; c < width - 2; c++) {
      const t = grid[r][c];
      if (t === TERRAIN.PLAINS || t === TERRAIN.COASTAL || t === TERRAIN.FOREST) {
        // Score: coastal adjacency is great, river is good
        let score = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const adj = grid[r + dr]?.[c + dc];
          if (adj === TERRAIN.OCEAN || adj === TERRAIN.COASTAL) score += 3;
          if (adj === TERRAIN.RIVER) score += 2;
          if (adj === TERRAIN.MOUNTAIN) score += 1;
          if (adj === TERRAIN.FOREST) score += 0.5;
        }
        score += hash(r, c, seed + 3000) * 2; // randomness
        landTiles.push({ row: r, col: c, score });
      }
    }
  }

  landTiles.sort((a, b) => b.score - a.score);

  // Pick cities with minimum distance between them
  const minDist = Math.max(3, Math.floor(Math.min(width, height) / (numCities / 2)));
  const chosenCities = [];
  for (const tile of landTiles) {
    if (chosenCities.length >= numCities) break;
    const tooClose = chosenCities.some(
      c => Math.abs(c.row - tile.row) + Math.abs(c.col - tile.col) < minDist
    );
    if (!tooClose) {
      chosenCities.push(tile);
    }
  }

  // Name cities
  const cityNames = [
    'Nordheim', 'Seaport', 'Oakridge', 'Ironpeak', 'Greenfield', 'Riverton',
    'Stonewall', 'Silverton', 'Meadowbrook', 'Pinewood', 'Cliffside', 'Sandshore',
    'Willowdale', 'Thornbury', 'Maplewood', 'Deepwater', 'Highgate', 'Foxhaven',
    'Redstone', 'Eastmarch', 'Goldvale', 'Lakeshire', 'Driftwood', 'Ashford',
  ];

  // Determine production costs from surrounding terrain
  const cities = chosenCities.map((tile, i) => {
    const surrounding = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const t = grid[tile.row + dr]?.[tile.col + dc];
        if (t) surrounding.push(t);
      }
    }

    const costs = { wheat: 4, fish: 4, iron: 4, silk: 4 };

    // Apply terrain bonuses
    for (const t of surrounding) {
      if (t === TERRAIN.OCEAN || t === TERRAIN.COASTAL || t === TERRAIN.RIVER) {
        costs.fish = Math.max(1, costs.fish - 0.5);
      }
      if (t === TERRAIN.PLAINS) {
        costs.wheat = Math.max(1, costs.wheat - 0.5);
      }
      if (t === TERRAIN.MOUNTAIN) {
        costs.iron = Math.max(1, costs.iron - 0.5);
      }
      if (t === TERRAIN.FOREST) {
        costs.silk = Math.max(1, costs.silk - 0.5);
      }
    }

    // If no relevant terrain, increase cost
    const hasWater = surrounding.some(t => t === TERRAIN.OCEAN || t === TERRAIN.COASTAL || t === TERRAIN.RIVER);
    if (!hasWater) costs.fish = Math.max(costs.fish, 8);

    const hasMountain = surrounding.some(t => t === TERRAIN.MOUNTAIN);
    if (!hasMountain) costs.iron = Math.max(costs.iron, 6);

    const hasForest = surrounding.some(t => t === TERRAIN.FOREST);
    if (!hasForest) costs.silk = Math.max(costs.silk, 6);

    const hasPlains = surrounding.some(t => t === TERRAIN.PLAINS);
    if (!hasPlains) costs.wheat = Math.max(costs.wheat, 6);

    return {
      name: cityNames[i % cityNames.length],
      row: tile.row,
      col: tile.col,
      population: 80 + Math.floor(hash(tile.row, tile.col, seed + 7000) * 80),
      productionCosts: costs,
    };
  });

  return {
    name: 'Random Map',
    description: `Randomly generated world with ${cities.length} cities.`,
    width,
    height,
    grid,
    cities,
    seed,
  };
}
