/**
 * Dijkstra's algorithm for shortest path through terrain grid.
 * Returns the minimum transport cost between two grid positions.
 */

import { TRANSPORT_COST, TERRAIN } from './terrain';

class MinHeap {
  constructor() {
    this.data = [];
  }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].cost < this.data[parent].cost) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].cost < this.data[smallest].cost) smallest = l;
      if (r < n && this.data[r].cost < this.data[smallest].cost) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/**
 * Find shortest path cost between two points on the terrain grid.
 * @param {string[][]} grid - 2D terrain grid
 * @param {{row: number, col: number}} start
 * @param {{row: number, col: number}} end
 * @returns {number} minimum transport cost
 */
export function findPathCost(grid, start, end) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dist = Array.from({ length: rows }, () => new Float64Array(cols).fill(Infinity));

  dist[start.row][start.col] = 0;
  const heap = new MinHeap();
  heap.push({ row: start.row, col: start.col, cost: 0 });

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

  while (heap.size > 0) {
    const { row, col, cost } = heap.pop();
    if (row === end.row && col === end.col) return cost;
    if (cost > dist[row][col]) continue;

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      const terrain = grid[nr][nc];
      const moveCost = TRANSPORT_COST[terrain] || 5;
      // Diagonal moves cost sqrt(2) times more
      const multiplier = (dr !== 0 && dc !== 0) ? 1.41 : 1;
      const newCost = cost + moveCost * multiplier;

      if (newCost < dist[nr][nc]) {
        dist[nr][nc] = newCost;
        heap.push({ row: nr, col: nc, cost: newCost });
      }
    }
  }

  return Infinity; // unreachable
}

/**
 * Cache transport costs between city pairs.
 */
const pathCostCache = new Map();

export function getTransportCost(grid, cityA, cityB) {
  const key = `${cityA.row},${cityA.col}-${cityB.row},${cityB.col}`;
  const reverseKey = `${cityB.row},${cityB.col}-${cityA.row},${cityA.col}`;

  if (pathCostCache.has(key)) return pathCostCache.get(key);
  if (pathCostCache.has(reverseKey)) return pathCostCache.get(reverseKey);

  const cost = findPathCost(grid, cityA, cityB);
  pathCostCache.set(key, cost);
  return cost;
}

export function clearPathCache() {
  pathCostCache.clear();
}
