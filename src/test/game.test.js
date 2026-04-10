/**
 * Tests for core Game model — city init, trade, turn resolution, missions, secession.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame,
  getCityConsumption,
  getCityUtility,
  getCityLabor,
  recalcTradeFlows,
  endTurn,
  getTransportCostBetween,
  getMissionCost,
  serializeGame,
  deserializeGame,
} from '../models/Game';
import { GOODS } from '../utils/economics';
import { tutorialMap } from '../maps/tutorial';

function makePlayers(n = 1) {
  const colors = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];
  return Array.from({ length: n }, (_, i) => ({
    name: `Player ${i + 1}`,
    isHuman: i === 0,
    color: colors[i],
  }));
}

describe('createGame', () => {
  it('creates a game with correct number of cities', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    expect(game.cities.length).toBe(tutorialMap.cities.length);
  });

  it('assigns first city to first player', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    expect(game.cities[0].leagueId).toBe(0);
  });

  it('assigns one city per player', () => {
    const game = createGame(tutorialMap, makePlayers(3));
    expect(game.cities[0].leagueId).toBe(0);
    expect(game.cities[1].leagueId).toBe(1);
    expect(game.cities[2].leagueId).toBe(2);
  });

  it('remaining cities are unaffiliated', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    for (let i = 1; i < game.cities.length; i++) {
      expect(game.cities[i].leagueId).toBeNull();
    }
  });

  it('starts on turn 1, player 0', () => {
    const game = createGame(tutorialMap, makePlayers(2));
    expect(game.turn).toBe(1);
    expect(game.currentPlayer).toBe(0);
  });

  it('all cities have valid autarchy utility', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    for (const city of game.cities) {
      expect(Number.isFinite(city.autarchyUtility)).toBe(true);
    }
  });

  it('cities start with autarchy-optimal production', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    for (const city of game.cities) {
      // Should have some production for each good they can produce
      const producible = GOODS.filter(g => city.productionCosts[g] < Infinity);
      for (const good of producible) {
        expect(city.production[good]).toBeGreaterThan(0);
      }
    }
  });

  it('city initial utility equals autarchy utility', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    for (const city of game.cities) {
      const utility = getCityUtility(city);
      expect(utility).toBeCloseTo(city.autarchyUtility, 5);
    }
  });
});

describe('getCityConsumption', () => {
  it('consumption = production + imports - exports', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    city.production = { wheat: 10, fish: 5, iron: 3, silk: 2 };
    city.imports = { wheat: 2, fish: 0, iron: 1, silk: 0 };
    city.exports = { wheat: 1, fish: 2, iron: 0, silk: 0 };
    const c = getCityConsumption(city);
    expect(c.wheat).toBe(11);
    expect(c.fish).toBe(3);
    expect(c.iron).toBe(4);
    expect(c.silk).toBe(2);
  });

  it('consumption floors at 0 (never negative)', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    city.production = { wheat: 0, fish: 0, iron: 0, silk: 0 };
    city.exports = { wheat: 5, fish: 5, iron: 5, silk: 5 };
    city.imports = { wheat: 0, fish: 0, iron: 0, silk: 0 };
    const c = getCityConsumption(city);
    for (const good of GOODS) {
      expect(c[good]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('getCityLabor', () => {
  it('reports correct total from population', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    const labor = getCityLabor(city, game);
    expect(labor.total).toBe(city.population);
  });

  it('remaining = total - production - transport labor', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    const labor = getCityLabor(city, game);
    expect(labor.remaining).toBeCloseTo(labor.total - labor.production - labor.transport, 5);
  });

  it('autarchy production uses all labor (no trades = 0 transport)', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    const labor = getCityLabor(city, game);
    expect(labor.transport).toBe(0);
    expect(labor.remaining).toBeCloseTo(0, 0);
  });
});

describe('recalcTradeFlows', () => {
  it('correctly distributes imports and exports from trades', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // Both cities in league
    game.cities[1].leagueId = 0;
    game.trades = [{
      fromCityId: 0,
      toCityId: 1,
      goods: { wheat: 5, fish: -3, iron: 0, silk: 0 },
    }];
    recalcTradeFlows(game);

    // City 0 exports 5 wheat, imports 3 fish
    expect(game.cities[0].exports.wheat).toBe(5);
    expect(game.cities[0].imports.fish).toBe(3);
    // City 1 imports 5 wheat, exports 3 fish
    expect(game.cities[1].imports.wheat).toBe(5);
    expect(game.cities[1].exports.fish).toBe(3);
  });

  it('resets flows before recalculating', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    game.cities[0].imports.wheat = 999; // stale data
    game.trades = [];
    recalcTradeFlows(game);
    expect(game.cities[0].imports.wheat).toBe(0);
  });

  it('handles multiple trades involving the same city', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    game.cities[1].leagueId = 0;
    game.cities[2].leagueId = 0;
    game.trades = [
      { fromCityId: 0, toCityId: 1, goods: { wheat: 3, fish: 0, iron: 0, silk: 0 } },
      { fromCityId: 0, toCityId: 2, goods: { wheat: 2, fish: 0, iron: 0, silk: 0 } },
    ];
    recalcTradeFlows(game);
    expect(game.cities[0].exports.wheat).toBe(5);
    expect(game.cities[1].imports.wheat).toBe(3);
    expect(game.cities[2].imports.wheat).toBe(2);
  });
});

describe('getTransportCostBetween', () => {
  it('returns a positive number for adjacent cities', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const cost = getTransportCostBetween(game, game.cities[0], game.cities[1]);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isFinite(cost)).toBe(true);
  });

  it('cost is symmetric', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const c1 = getTransportCostBetween(game, game.cities[0], game.cities[1]);
    const c2 = getTransportCostBetween(game, game.cities[1], game.cities[0]);
    expect(c1).toBeCloseTo(c2, 5);
  });

  it('cost to self is 0', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const cost = getTransportCostBetween(game, game.cities[0], game.cities[0]);
    expect(cost).toBe(0);
  });
});

describe('getMissionCost', () => {
  it('returns a positive number', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const cost = getMissionCost(game, game.cities[0], game.cities[1]);
    expect(cost).toBeGreaterThan(0);
  });

  it('cost increases with distance', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // Find the closest and farthest city from city 0
    let closest = null, farthest = null, minDist = Infinity, maxDist = 0;
    for (let i = 1; i < game.cities.length; i++) {
      const dist = Math.abs(game.cities[0].row - game.cities[i].row) +
                   Math.abs(game.cities[0].col - game.cities[i].col);
      if (dist < minDist) { minDist = dist; closest = game.cities[i]; }
      if (dist > maxDist) { maxDist = dist; farthest = game.cities[i]; }
    }
    if (closest && farthest && closest.id !== farthest.id) {
      const costClose = getMissionCost(game, game.cities[0], closest);
      const costFar = getMissionCost(game, game.cities[0], farthest);
      expect(costFar).toBeGreaterThan(costClose);
    }
  });
});

describe('endTurn', () => {
  it('advances currentPlayer', () => {
    const game = createGame(tutorialMap, makePlayers(2));
    expect(game.currentPlayer).toBe(0);
    endTurn(game);
    expect(game.currentPlayer).toBe(1);
  });

  it('advances turn number when all players have gone', () => {
    const game = createGame(tutorialMap, makePlayers(2));
    expect(game.turn).toBe(1);
    endTurn(game); // player 0 done
    expect(game.turn).toBe(1); // still turn 1 (player 1 hasn't gone)
    endTurn(game); // player 1 done
    expect(game.turn).toBe(2);
  });

  it('accumulates score', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    expect(game.leagues[0].score).toBe(0);
    endTurn(game);
    // Score should be >= 0 (utility gain above autarchy is 0 at start)
    expect(game.leagues[0].score).toBeGreaterThanOrEqual(0);
  });

  it('returns log messages array', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const messages = endTurn(game);
    expect(Array.isArray(messages)).toBe(true);
  });

  it('resolves trade missions', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // Boost utility of league city to increase acceptance chance
    const myCity = game.cities[0];
    // Add a mission
    game.missions.push({
      leagueId: 0,
      fromCityId: 0,
      toCityId: 1,
      guaranteedUtility: null,
    });
    expect(game.missions.length).toBe(1);
    endTurn(game);
    // Mission should be resolved (removed from pending)
    expect(game.missions.filter(m => m.leagueId === 0).length).toBe(0);
  });

  it('does not secede on turn 1', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // Make city utility awful
    game.cities[0].production = { wheat: 0, fish: 0, iron: 0, silk: 0 };
    endTurn(game);
    // Should not secede on turn 1
    expect(game.cities[0].leagueId).toBe(0);
  });
});

describe('serialize/deserialize', () => {
  it('round-trips game state', () => {
    const game = createGame(tutorialMap, makePlayers(2));
    const json = serializeGame(game);
    const restored = deserializeGame(json);
    expect(restored.turn).toBe(game.turn);
    expect(restored.cities.length).toBe(game.cities.length);
    expect(restored.leagues.length).toBe(game.leagues.length);
    expect(restored.cities[0].name).toBe(game.cities[0].name);
  });

  it('serializes to valid JSON string', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const json = serializeGame(game);
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
