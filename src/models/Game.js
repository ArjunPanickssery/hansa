/**
 * Core game state management.
 * Holds all state: map, cities, leagues, trades, turn info.
 */

import { GOODS, calcUtility, calcAutarchy, calcLaborUsed } from '../utils/economics';
import { getTransportCost, clearPathCache } from '../utils/pathfinding';

/**
 * Create a new city state object from a map city definition.
 */
function initCity(def, id) {
  const autarchy = calcAutarchy(def.population, def.productionCosts);
  const production = {};
  // Start with autarchy-optimal production
  for (const good of GOODS) {
    const cost = def.productionCosts[good];
    if (cost && cost < Infinity) {
      production[good] = autarchy.consumption[good];
    } else {
      production[good] = 0;
    }
  }

  return {
    id,
    name: def.name,
    row: def.row,
    col: def.col,
    population: def.population,
    productionCosts: { ...def.productionCosts },
    production: { ...production },
    imports: { wheat: 0, fish: 0, iron: 0, silk: 0 },
    exports: { wheat: 0, fish: 0, iron: 0, silk: 0 },
    leagueId: null, // null = unaffiliated
    autarchyUtility: autarchy.utility,
    guaranteedUtility: null, // set when city joins with a guarantee
  };
}

/**
 * Calculate a city's current consumption and utility.
 */
export function getCityConsumption(city) {
  const consumption = {};
  for (const good of GOODS) {
    consumption[good] = Math.max(0,
      (city.production[good] || 0) + (city.imports[good] || 0) - (city.exports[good] || 0)
    );
  }
  return consumption;
}

export function getCityUtility(city) {
  return calcUtility(getCityConsumption(city));
}

/**
 * Get labor used and remaining for a city.
 * Transport labor for exports is tracked separately via getTradeTransportLabor.
 */
export function getCityLabor(city, game) {
  const productionLabor = calcLaborUsed(city.production, city.productionCosts);
  let transportLabor = 0;
  if (game) {
    for (const trade of game.trades) {
      for (const good of GOODS) {
        const amount = trade.goods[good] || 0;
        // Positive amount = fromCity exports; negative = toCity exports
        let exportingCityId = null;
        let exportedAmount = 0;
        if (amount > 0) {
          exportingCityId = trade.fromCityId;
          exportedAmount = amount;
        } else if (amount < 0) {
          exportingCityId = trade.toCityId;
          exportedAmount = -amount;
        }
        if (exportingCityId === city.id && exportedAmount > 0) {
          const otherCity = game.cities[
            exportingCityId === trade.fromCityId ? trade.toCityId : trade.fromCityId
          ];
          const costPerUnit = getTransportCost(game.map.grid, city, otherCity);
          transportLabor += exportedAmount * costPerUnit;
        }
      }
    }
  }
  return {
    total: city.population,
    production: productionLabor,
    transport: transportLabor,
    remaining: city.population - productionLabor - transportLabor,
  };
}

/**
 * Create the initial game state.
 */
export function createGame(mapData, players) {
  clearPathCache();

  const cities = mapData.cities.map((def, i) => initCity(def, i));

  // First human player starts with the first city in their league
  const leagues = players.map((p, i) => ({
    id: i,
    name: p.name,
    color: p.color,
    isHuman: p.isHuman,
    score: 0,
  }));

  // Assign starting cities — each player gets one city
  players.forEach((p, i) => {
    if (i < cities.length) {
      cities[i].leagueId = i;
    }
  });

  return {
    map: {
      name: mapData.name,
      width: mapData.width,
      height: mapData.height,
      grid: mapData.grid,
    },
    cities,
    leagues,
    trades: [], // { fromCityId, toCityId, goods: { wheat: amount, ... } }
    turn: 1,
    currentPlayer: 0,
    phase: 'production', // 'production' | 'trade' | 'missions' | 'resolve'
    missions: [], // pending trade missions: { fromCityId, toCityId, guaranteedUtility }
    log: [],
    gameOver: false,
  };
}

/**
 * Calculate transport cost between two cities.
 */
export function getTransportCostBetween(game, cityA, cityB) {
  return getTransportCost(game.map.grid, cityA, cityB);
}

/**
 * Calculate the transport labor cost for a trade route.
 * Each unit of any good shipped costs transportCost labor from the exporting city.
 */
export function getTradeTransportLabor(game, trade) {
  const cityFrom = game.cities[trade.fromCityId];
  const cityTo = game.cities[trade.toCityId];
  const costPerUnit = getTransportCostBetween(game, cityFrom, cityTo);

  let totalUnits = 0;
  for (const good of GOODS) {
    totalUnits += Math.abs(trade.goods[good] || 0);
  }

  return totalUnits * costPerUnit;
}

/**
 * Recalculate all imports/exports from the trade list.
 */
export function recalcTradeFlows(game) {
  // Reset all imports/exports
  for (const city of game.cities) {
    for (const good of GOODS) {
      city.imports[good] = 0;
      city.exports[good] = 0;
    }
  }

  // Apply each trade
  for (const trade of game.trades) {
    for (const good of GOODS) {
      const amount = trade.goods[good] || 0;
      if (amount > 0) {
        // Positive = from → to
        game.cities[trade.fromCityId].exports[good] += amount;
        game.cities[trade.toCityId].imports[good] += amount;
      } else if (amount < 0) {
        // Negative = to → from
        game.cities[trade.toCityId].exports[good] += -amount;
        game.cities[trade.fromCityId].imports[good] += -amount;
      }
    }
  }
}

/**
 * End the current player's turn and resolve events.
 */
export function endTurn(game) {
  const log = [];
  const currentLeague = game.leagues[game.currentPlayer];

  // 1. Calculate scores: utility gain above autarchy for each league city
  for (const city of game.cities) {
    if (city.leagueId === game.currentPlayer) {
      const utility = getCityUtility(city);
      const gain = Math.max(0, utility - city.autarchyUtility);
      currentLeague.score += gain;
    }
  }

  // 2. Resolve trade missions
  for (const mission of game.missions) {
    if (mission.leagueId !== game.currentPlayer) continue;

    const targetCity = game.cities[mission.toCityId];
    if (targetCity.leagueId !== null) {
      log.push(`${targetCity.name} is already in a league — mission failed.`);
      continue;
    }

    // Acceptance probability based on nearby league cities' utility gain
    const nearbyGains = [];
    for (const city of game.cities) {
      if (city.leagueId !== game.currentPlayer) continue;
      const dist = Math.abs(city.row - targetCity.row) + Math.abs(city.col - targetCity.col);
      if (dist < 15) {
        const utilGain = getCityUtility(city) - city.autarchyUtility;
        nearbyGains.push(utilGain / (1 + dist * 0.1));
      }
    }

    const avgGain = nearbyGains.length > 0
      ? nearbyGains.reduce((s, g) => s + g, 0) / nearbyGains.length
      : 0;

    const k = 0.5;
    const threshold = 0.2;
    const pAccept = 1 / (1 + Math.exp(-k * (avgGain - threshold)));

    if (Math.random() < pAccept) {
      targetCity.leagueId = game.currentPlayer;
      targetCity.guaranteedUtility = mission.guaranteedUtility || null;
      log.push(`${targetCity.name} joined ${currentLeague.name}! (p=${(pAccept * 100).toFixed(0)}%)`);
    } else {
      log.push(`${targetCity.name} declined the trade mission. (p=${(pAccept * 100).toFixed(0)}%)`);
    }
  }

  // Remove resolved missions for current player
  game.missions = game.missions.filter(m => m.leagueId !== game.currentPlayer);

  // 3. Check for secession
  for (const city of game.cities) {
    if (city.leagueId !== game.currentPlayer) continue;
    // Don't secede on turn 1
    if (game.turn <= 1) continue;

    const utility = getCityUtility(city);

    // Check against guaranteed utility
    if (city.guaranteedUtility && utility < city.guaranteedUtility) {
      const deficit = (city.guaranteedUtility - utility) / Math.abs(city.guaranteedUtility);
      const pSecede = Math.min(0.9, deficit * 3);
      if (Math.random() < pSecede) {
        const guaranteedLevel = city.guaranteedUtility;
        city.leagueId = null;
        city.guaranteedUtility = null;
        // Remove trades involving this city
        game.trades = game.trades.filter(
          t => t.fromCityId !== city.id && t.toCityId !== city.id
        );
        log.push(`${city.name} seceded! Utility ${utility.toFixed(2)} was below guaranteed ${guaranteedLevel.toFixed(2)}.`);
        continue;
      }
    }

    // Check against autarchy (5% tolerance band — small dips don't trigger)
    if (utility < city.autarchyUtility * 0.95) {
      const deficit = (city.autarchyUtility - utility) / Math.abs(city.autarchyUtility);
      const pSecede = Math.min(0.8, deficit * 2);
      if (Math.random() < pSecede) {
        city.leagueId = null;
        city.guaranteedUtility = null;
        // Remove trades involving this city
        game.trades = game.trades.filter(
          t => t.fromCityId !== city.id && t.toCityId !== city.id
        );
        log.push(`${city.name} seceded! Utility ${utility.toFixed(2)} was below autarchy ${city.autarchyUtility.toFixed(2)}.`);
      }
    }
  }

  // 4. Advance to next player
  game.currentPlayer = (game.currentPlayer + 1) % game.leagues.length;
  if (game.currentPlayer === 0) {
    game.turn++;
  }
  game.phase = 'production';

  // 5. Check if all cities are in a single league (game over condition)
  const affiliatedCities = game.cities.filter(c => c.leagueId !== null);
  if (affiliatedCities.length === game.cities.length) {
    const leagueIds = new Set(affiliatedCities.map(c => c.leagueId));
    if (leagueIds.size === 1) {
      game.gameOver = true;
      log.push('All cities are in one league! Game over!');
    }
  }

  game.log.push({ turn: game.turn - (game.currentPlayer === 0 ? 0 : 1), player: currentLeague.name, messages: log });
  recalcTradeFlows(game);

  return log;
}

/**
 * Get the labor cost to send a trade mission from one city to another.
 */
export function getMissionCost(game, fromCity, toCity) {
  const dist = Math.abs(fromCity.row - toCity.row) + Math.abs(fromCity.col - toCity.col);
  return Math.max(2, Math.ceil(dist * 0.5));
}

/**
 * Serialize game state for save.
 */
export function serializeGame(game) {
  return JSON.stringify(game);
}

/**
 * Deserialize game state from save.
 */
export function deserializeGame(json) {
  return JSON.parse(json);
}
