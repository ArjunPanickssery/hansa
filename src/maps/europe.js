/**
 * Napoleonic Europe map: 40x30 grid with 18 cities.
 * Hand-drawn to approximate real European geography.
 * Each cell is ~100km. Row 0 = ~62°N, Row 29 = ~32°N.
 * Col 0 = ~12°W, Col 39 = ~42°E.
 */

import { TERRAIN } from '../utils/terrain';

const O = TERRAIN.OCEAN;
const C = TERRAIN.COASTAL;
const P = TERRAIN.PLAINS;
const F = TERRAIN.FOREST;
const M = TERRAIN.MOUNTAIN;
const R = TERRAIN.RIVER;

// Encode the map as a 30×40 character grid for readability.
// Legend: . = ocean, ~ = coastal, = = plains, # = mountain, % = forest, r = river
const MAP_STRING = `
........................................
........................................
.............~~%%~%.....................
............~==%%~~...........====%=....
....~~......~===%~~~..........==%%==....
....~==~...~~===~~...........~=%%===...
....~==%~..~~===~~..........~==%%===...
....~==~..~~=~r==~~r=====r====%=====...
....~==~..~~==r===========r====%=====..
.....~~..~~===r======%=r=========%===..
..........~===rr====%%=r==%=======%==..
..........~=r==r===%===r==%==========..
..........~==rr====#####==r==%=====r=..
.........~~===r=###===##==r===%===r==..
.........~~~=rr##~=======~r====%=r===..
.......~~=~=#~~=====~~===~r===r======..
......~===~##~====~..~==~==%=r==#===..
.....~=====~~===~....~=====%r==###===..
.....~====%~~==~.....~==~~==%===##~~...
.....~~~~~.~~=~...~~=~~...~~~~==~.~....
......~~....~~~..~=~=~~.~=~~..~~.~~.~...
.......~....~=~..~~~.......~==~.~......
............~~~..........~=~~..........
......~~~~..~~...........~~............
......~==~.......~~~~~~................
......~===~......~==r=~................
.......~~~~.......~~~~.................
........................................
........................................
........................................
`;

function parseMap() {
  const charMap = {
    '.': O, '~': C, '=': P, '#': M, '%': F, 'r': R,
  };
  const lines = MAP_STRING.trim().split('\n');
  const grid = [];
  for (let r = 0; r < 30; r++) {
    const row = [];
    const line = lines[r] || '';
    for (let c = 0; c < 40; c++) {
      const ch = line[c] || '.';
      row.push(charMap[ch] || O);
    }
    grid.push(row);
  }
  return grid;
}

const grid = parseMap();

const cities = [
  // British Isles
  { name: 'London', row: 8, col: 5, population: 150,
    productionCosts: { wheat: 4, fish: 2, iron: 6, silk: 8 } },
  // Low Countries
  { name: 'Amsterdam', row: 7, col: 11, population: 120,
    productionCosts: { wheat: 3, fish: 2, iron: 7, silk: 7 } },
  { name: 'Antwerp', row: 8, col: 12, population: 100,
    productionCosts: { wheat: 3, fish: 3, iron: 6, silk: 6 } },
  // North Germany
  { name: 'Hamburg', row: 7, col: 15, population: 110,
    productionCosts: { wheat: 3, fish: 2, iron: 5, silk: 7 } },
  // France
  { name: 'Paris', row: 11, col: 11, population: 160,
    productionCosts: { wheat: 2, fish: 5, iron: 6, silk: 4 } },
  { name: 'Bordeaux', row: 13, col: 9, population: 90,
    productionCosts: { wheat: 2, fish: 3, iron: 8, silk: 5 } },
  // Iberia
  { name: 'Lisbon', row: 18, col: 5, population: 100,
    productionCosts: { wheat: 4, fish: 1.5, iron: 7, silk: 7 } },
  { name: 'Barcelona', row: 16, col: 12, population: 100,
    productionCosts: { wheat: 3, fish: 2, iron: 6, silk: 4 } },
  // Italy
  { name: 'Venice', row: 14, col: 20, population: 120,
    productionCosts: { wheat: 5, fish: 2, iron: 4, silk: 3 } },
  { name: 'Genoa', row: 15, col: 18, population: 90,
    productionCosts: { wheat: 4, fish: 2, iron: 5, silk: 4 } },
  { name: 'Naples', row: 19, col: 20, population: 110,
    productionCosts: { wheat: 2, fish: 2, iron: 7, silk: 5 } },
  // Central Europe
  { name: 'Vienna', row: 12, col: 21, population: 130,
    productionCosts: { wheat: 2, fish: 7, iron: 3, silk: 5 } },
  // Scandinavia
  { name: 'Copenhagen', row: 5, col: 15, population: 80,
    productionCosts: { wheat: 4, fish: 1.5, iron: 7, silk: 8 } },
  { name: 'Stockholm', row: 3, col: 18, population: 80,
    productionCosts: { wheat: 5, fish: 2, iron: 3, silk: 7 } },
  // Eastern Europe
  { name: 'Danzig', row: 7, col: 21, population: 90,
    productionCosts: { wheat: 2, fish: 3, iron: 5, silk: 7 } },
  { name: 'Novgorod', row: 3, col: 31, population: 80,
    productionCosts: { wheat: 4, fish: 3, iron: 3, silk: 6 } },
  // Balkans / Eastern Med
  { name: 'Constantinople', row: 17, col: 29, population: 180,
    productionCosts: { wheat: 3, fish: 2, iron: 5, silk: 2 } },
  { name: 'Athens', row: 20, col: 24, population: 90,
    productionCosts: { wheat: 4, fish: 2, iron: 6, silk: 4 } },
];

export const europeMap = {
  name: 'Napoleonic Europe',
  description: 'Trade across Europe from London to Constantinople. Navigate the Mediterranean, brave the Alps, and exploit river trade routes.',
  width: 40,
  height: 30,
  grid,
  cities,
};
