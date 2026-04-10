/**
 * Tutorial map: small 20x15 map with 4 cities.
 * Designed to teach basic mechanics of trade and comparative advantage.
 */

import { TERRAIN } from '../utils/terrain';

const O = TERRAIN.OCEAN;
const C = TERRAIN.COASTAL;
const P = TERRAIN.PLAINS;
const F = TERRAIN.FOREST;
const M = TERRAIN.MOUNTAIN;
const R = TERRAIN.RIVER;

// 15 rows x 20 cols
const grid = [
  [O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O],
  [O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O],
  [O, O, O, C, C, P, P, P, P, P, P, P, P, C, C, O, O, O, O, O],
  [O, O, C, C, P, P, P, P, P, P, F, F, P, P, C, C, O, O, O, O],
  [O, O, C, P, P, P, R, P, P, F, F, F, F, P, P, C, O, O, O, O],
  [O, O, C, P, P, R, R, P, P, P, F, F, M, M, P, C, C, O, O, O],
  [O, O, C, C, P, P, R, P, P, P, P, M, M, M, P, P, C, O, O, O],
  [O, O, O, C, P, P, R, P, P, P, P, P, M, P, P, P, C, O, O, O],
  [O, O, O, C, C, P, P, R, P, P, P, P, P, P, P, C, C, O, O, O],
  [O, O, O, O, C, P, P, P, R, P, P, P, P, P, C, C, O, O, O, O],
  [O, O, O, O, C, C, P, P, P, R, R, P, P, C, C, O, O, O, O, O],
  [O, O, O, O, O, C, C, P, P, P, P, R, C, C, O, O, O, O, O, O],
  [O, O, O, O, O, O, C, C, C, C, C, C, C, O, O, O, O, O, O, O],
  [O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O],
  [O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O],
];

const cities = [
  {
    name: 'Millhaven',
    row: 3,
    col: 5,
    population: 100,
    // Near plains + river = good at wheat and fish
    productionCosts: { wheat: 1.5, fish: 2, iron: 8, silk: 8 },
  },
  {
    name: 'Ironhold',
    row: 6,
    col: 12,
    population: 100,
    // Near mountains = good at iron
    productionCosts: { wheat: 6, fish: 10, iron: 1.5, silk: 6 },
  },
  {
    name: 'Silkwood',
    row: 4,
    col: 10,
    population: 100,
    // In forest = good at silk
    productionCosts: { wheat: 6, fish: 8, iron: 6, silk: 1.5 },
  },
  {
    name: 'Porto',
    row: 9,
    col: 5,
    population: 100,
    // Coastal = good at fish
    productionCosts: { wheat: 6, fish: 1.5, iron: 8, silk: 8 },
  },
];

export const tutorialMap = {
  name: 'Tutorial Island',
  description: 'A small island with 4 cities. Perfect for learning the basics of trade and comparative advantage.',
  width: 20,
  height: 15,
  grid,
  cities,
};
