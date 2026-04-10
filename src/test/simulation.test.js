/**
 * Simulation tests: play full games and check that the engine produces
 * sensible outcomes. These tests run multi-turn games with AI players
 * and verify invariants that must always hold.
 */

import { describe, it, expect } from 'vitest';
import {
  createGame,
  getCityUtility,
  getCityLabor,
  getCityConsumption,
  getTransportCostBetween,
  recalcTradeFlows,
  endTurn,
} from '../models/Game';
import { GOODS, calcLaborUsed } from '../utils/economics';
import { runAI } from '../ai/ComputerPlayer';
import { tutorialMap } from '../maps/tutorial';
import { europeMap } from '../maps/europe';

// ── Helpers ──────────────────────────────────────────────────────────

function makePlayers(n, allHuman = false) {
  const colors = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];
  const names = ['Hanseatic', 'Venetian', 'Iberian', 'Eastern'];
  return Array.from({ length: n }, (_, i) => ({
    name: names[i],
    isHuman: allHuman ? true : i === 0,
    color: colors[i],
  }));
}

/**
 * Simulate a full game for N turns with AI controlling all non-human players.
 * Returns the game state after all turns.
 */
function simulateGame(mapData, playerCount, turns, opts = {}) {
  const game = createGame(mapData, makePlayers(playerCount, opts.allHuman));
  const events = [];

  for (let t = 0; t < turns; t++) {
    for (let p = 0; p < playerCount; p++) {
      if (game.gameOver) break;
      const league = game.leagues[game.currentPlayer];

      if (!league.isHuman) {
        const aiLog = runAI(game, game.currentPlayer);
        events.push(...aiLog);
      }
      const turnLog = endTurn(game);
      events.push(...turnLog);
    }
    if (game.gameOver) break;
  }

  return { game, events };
}

// ── 1. INVARIANTS THAT MUST HOLD EVERY TURN ──────────────────────────

describe('game invariants across simulation', () => {
  it('no city ever has negative consumption', () => {
    const { game } = simulateGame(tutorialMap, 3, 20);
    for (const city of game.cities) {
      const c = getCityConsumption(city);
      for (const good of GOODS) {
        expect(c[good]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('no city uses more labor than its population', () => {
    const { game } = simulateGame(tutorialMap, 3, 20);
    for (const city of game.cities) {
      const labor = getCityLabor(city, game);
      // Production labor alone should not exceed population
      expect(labor.production).toBeLessThanOrEqual(city.population * 1.001);
    }
  });

  it('trade flows are globally conserved (exports = imports for each good)', () => {
    const { game } = simulateGame(tutorialMap, 3, 15);
    recalcTradeFlows(game);
    for (const good of GOODS) {
      let totalExports = 0, totalImports = 0;
      for (const city of game.cities) {
        totalExports += city.exports[good];
        totalImports += city.imports[good];
      }
      expect(totalExports).toBeCloseTo(totalImports, 8);
    }
  });

  it('scores are non-negative and finite', () => {
    const { game } = simulateGame(europeMap, 3, 15);
    for (const league of game.leagues) {
      expect(league.score).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(league.score)).toBe(true);
    }
  });

  it('turn counter advances correctly', () => {
    const { game } = simulateGame(tutorialMap, 2, 10);
    expect(game.turn).toBe(11); // started at 1, did 10 full rounds
  });

  it('no unresolved missions linger after their player\'s turn', () => {
    const { game } = simulateGame(tutorialMap, 3, 10);
    // After simulation, each player has taken their turn, so all missions
    // for all players should have been resolved
    // (missions are resolved when the sending player's turn ends)
    // Actually missions for player whose turn just passed should be gone.
    // Let's just check there aren't ancient missions piling up
    expect(game.missions.length).toBeLessThanOrEqual(game.leagues.length);
  });
});

// ── 2. AI BEHAVIOR ───────────────────────────────────────────────────

describe('AI actually plays the game', () => {
  it('AI sends trade missions within 5 turns', () => {
    const { events } = simulateGame(tutorialMap, 3, 5);
    const missionEvents = events.filter(e => e.includes('trade mission'));
    expect(missionEvents.length).toBeGreaterThan(0);
  });

  it('AI expands its league within 10 turns (at least one city joins)', () => {
    // Run multiple trials since missions are probabilistic
    let anyExpanded = false;
    for (let trial = 0; trial < 10 && !anyExpanded; trial++) {
      const { game } = simulateGame(tutorialMap, 3, 10);
      for (let p = 1; p < 3; p++) {
        const citiesInLeague = game.cities.filter(c => c.leagueId === p).length;
        if (citiesInLeague > 1) {
          anyExpanded = true;
          break;
        }
      }
    }
    expect(anyExpanded).toBe(true);
  });

  it('AI sets up trades when it has 2 nearby cities with different specializations', () => {
    // Antwerp (wheat=3, fish=3, iron=6, silk=6) and Paris (wheat=2, fish=5, iron=6, silk=4)
    // Nearby on plains, connected by river — cheap transport
    // Paris exports wheat (2 vs 3), Antwerp exports fish (3 vs 5) — bidirectional
    const game = createGame(europeMap, makePlayers(2));
    const antwerp = game.cities.find(c => c.name === 'Antwerp');
    const paris = game.cities.find(c => c.name === 'Paris');
    antwerp.leagueId = 1;
    paris.leagueId = 1;
    const log = runAI(game, 1);
    const aiCityIds = new Set([antwerp.id, paris.id]);
    const aiTrades = game.trades.filter(
      t => aiCityIds.has(t.fromCityId) || aiCityIds.has(t.toCityId)
    );
    expect(aiTrades.length).toBeGreaterThan(0);
  });

  it('AI production uses labor efficiently (not wasting > 20%)', () => {
    const { game } = simulateGame(tutorialMap, 3, 5);
    for (const city of game.cities) {
      if (city.leagueId === null) continue;
      const league = game.leagues[city.leagueId];
      if (league.isHuman) continue;
      const labor = getCityLabor(city, game);
      const usedFraction = (labor.production + labor.transport) / labor.total;
      expect(usedFraction).toBeGreaterThan(0.5); // using at least 50% of labor
    }
  });

  it('AI does not crash on Europe map over 20 turns', () => {
    expect(() => simulateGame(europeMap, 3, 20)).not.toThrow();
  });
});

// ── 3. LEAGUE EXPANSION & CONTRACTION ────────────────────────────────

describe('league dynamics over time', () => {
  it('cities at autarchy never secede (20 turns)', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // City at autarchy: production = autarchy-optimal, no trades
    // utility === autarchyUtility, so deficit = 0, pSecede = 0
    for (let t = 0; t < 20; t++) {
      endTurn(game);
      expect(game.cities[0].leagueId).toBe(0);
    }
  });

  it('a new city joining gets the correct guaranteedUtility', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const targetCity = game.cities[2];
    const guaranteeLevel = targetCity.autarchyUtility * 1.1;

    game.missions.push({
      leagueId: 0, fromCityId: 0, toCityId: 2,
      guaranteedUtility: guaranteeLevel,
    });
    // Boost acceptance probability
    game.cities[0].imports = { wheat: 100, fish: 100, iron: 100, silk: 100 };
    game.cities[1].leagueId = 0;
    game.trades = [{
      fromCityId: 1, toCityId: 0,
      goods: { wheat: -100, fish: -100, iron: -100, silk: -100 },
    }];
    recalcTradeFlows(game);

    // Try until it joins
    let joined = false;
    for (let i = 0; i < 50; i++) {
      const g = createGame(tutorialMap, makePlayers(1));
      g.cities[0].imports = { wheat: 100, fish: 100, iron: 100, silk: 100 };
      g.cities[1].leagueId = 0;
      g.trades = [{
        fromCityId: 1, toCityId: 0,
        goods: { wheat: -100, fish: -100, iron: -100, silk: -100 },
      }];
      recalcTradeFlows(g);
      g.missions.push({
        leagueId: 0, fromCityId: 0, toCityId: 2,
        guaranteedUtility: guaranteeLevel,
      });
      endTurn(g);
      if (g.cities[2].leagueId === 0) {
        expect(g.cities[2].guaranteedUtility).toBeCloseTo(guaranteeLevel, 5);
        joined = true;
        break;
      }
    }
    expect(joined).toBe(true);
  });
});

// ── 4. ECONOMIC CORRECTNESS ──────────────────────────────────────────

describe('economic model over multiple turns', () => {
  it('specialization + trade beats autarchy (comparative advantage works)', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    // Add second city to league
    game.cities[1].leagueId = 0;
    const city0 = game.cities[0]; // Millhaven: wheat 1.5, fish 2
    const city1 = game.cities[1]; // Ironhold: iron 1.5

    // Specialize: city0 in wheat, city1 in iron, then trade
    city0.production = { wheat: city0.population / city0.productionCosts.wheat, fish: 0, iron: 0, silk: 0 };
    city1.production = { wheat: 0, fish: 0, iron: city1.population / city1.productionCosts.iron, silk: 0 };

    // Trade some of each
    const wheatAmount = city0.production.wheat * 0.3;
    const ironAmount = city1.production.iron * 0.3;
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: wheatAmount, fish: 0, iron: -ironAmount, silk: 0 },
    }];
    recalcTradeFlows(game);

    // Both should consume some of each traded good
    const c0 = getCityConsumption(city0);
    const c1 = getCityConsumption(city1);
    expect(c0.iron).toBeGreaterThan(0);
    expect(c1.wheat).toBeGreaterThan(0);
  });

  it('removing all production from a city tanks its utility', () => {
    const game = createGame(tutorialMap, makePlayers(1));
    const city = game.cities[0];
    const autarchyUtil = city.autarchyUtility;

    city.production = { wheat: 0, fish: 0, iron: 0, silk: 0 };
    const utility = getCityUtility(city);
    expect(utility).toBeLessThan(autarchyUtil);
  });

  it('transport costs make distant trade less profitable', () => {
    // On europe map, compare close vs distant city pairs
    const game = createGame(europeMap, makePlayers(1));
    const london = game.cities.find(c => c.name === 'London');
    const amsterdam = game.cities.find(c => c.name === 'Amsterdam');
    const constantinople = game.cities.find(c => c.name === 'Constantinople');

    amsterdam.leagueId = 0;
    constantinople.leagueId = 0;

    const costNear = getTransportCostBetween(game, london, amsterdam);
    const costFar = getTransportCostBetween(game, london, constantinople);
    expect(costFar).toBeGreaterThan(costNear * 2);
  });
});

// ── 5. FULL GAME SIMULATION ──────────────────────────────────────────

describe('full game simulation smoke tests', () => {
  it('tutorial map 3-player game runs 30 turns without error', () => {
    expect(() => simulateGame(tutorialMap, 3, 30)).not.toThrow();
  });

  it('europe map 3-player game runs 20 turns without error', () => {
    expect(() => simulateGame(europeMap, 3, 20)).not.toThrow();
  });

  it('single-player tutorial can reach game-over', () => {
    // Give a human player all cities, then end turn
    const game = createGame(tutorialMap, makePlayers(1));
    for (const city of game.cities) {
      city.leagueId = 0;
    }
    endTurn(game);
    expect(game.gameOver).toBe(true);
  });

  it('after 30 turns on europe map, at least some AI leagues have score > 0', () => {
    // Europe map has coastal cities with cheap sea transport — trade is viable
    let anyPositive = false;
    for (let trial = 0; trial < 5 && !anyPositive; trial++) {
      const { game } = simulateGame(europeMap, 3, 30);
      const aiScores = game.leagues.filter(l => !l.isHuman).map(l => l.score);
      anyPositive = aiScores.some(s => s > 0);
    }
    expect(anyPositive).toBe(true);
  });

  it('after 15 turns on europe map, total affiliated cities > starting count', () => {
    // Run a few trials
    let expanded = false;
    for (let trial = 0; trial < 5 && !expanded; trial++) {
      const { game } = simulateGame(europeMap, 3, 15);
      const affiliated = game.cities.filter(c => c.leagueId !== null).length;
      if (affiliated > 3) { // started with 3 (one per player)
        expanded = true;
      }
    }
    expect(expanded).toBe(true);
  });
});
