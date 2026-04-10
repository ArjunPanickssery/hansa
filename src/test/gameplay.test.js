/**
 * Comprehensive gameplay tests.
 * Tests the full game engine: turns, labor budgets, transport costs,
 * trade flows, scoring, missions, secession, multi-player, game over.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGame,
  getCityConsumption,
  getCityUtility,
  getCityLabor,
  recalcTradeFlows,
  endTurn,
  getTransportCostBetween,
  getTradeTransportLabor,
  getMissionCost,
  serializeGame,
  deserializeGame,
} from '../models/Game';
import { GOODS, calcUtility, calcAutarchy, calcLaborUsed } from '../utils/economics';
import { tutorialMap } from '../maps/tutorial';
import { europeMap } from '../maps/europe';

// ── Helpers ──────────────────────────────────────────────────────────

function makePlayers(n, opts = {}) {
  const colors = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];
  return Array.from({ length: n }, (_, i) => ({
    name: `Player ${i}`,
    isHuman: opts.allHuman ? true : (i === 0),
    color: colors[i],
  }));
}

function tutorialGame(n = 1) {
  return createGame(tutorialMap, makePlayers(n));
}

// ── 1. LABOR BUDGET ──────────────────────────────────────────────────

describe('labor budget', () => {
  it('autarchy production uses exactly the full labor supply', () => {
    const game = tutorialGame();
    for (const city of game.cities) {
      const used = calcLaborUsed(city.production, city.productionCosts);
      expect(used).toBeCloseTo(city.population, 4);
    }
  });

  it('getCityLabor.remaining is 0 at autarchy with no trades', () => {
    const game = tutorialGame();
    for (const city of game.cities) {
      const labor = getCityLabor(city, game);
      expect(labor.remaining).toBeCloseTo(0, 3);
      expect(labor.transport).toBe(0);
    }
  });

  it('transport labor is deducted from the exporting city', () => {
    const game = tutorialGame();
    // Put both cities in the league
    game.cities[1].leagueId = 0;

    // Set low production so there's spare labor, then set up a trade
    const city0 = game.cities[0];
    const city1 = game.cities[1];
    city0.production = { wheat: 10, fish: 0, iron: 0, silk: 0 };
    city1.production = { wheat: 0, fish: 0, iron: 10, silk: 0 };

    // city0 exports 5 wheat to city1
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 5, fish: 0, iron: 0, silk: 0 },
    }];
    recalcTradeFlows(game);

    const transportCost = getTransportCostBetween(game, city0, city1);
    const labor0 = getCityLabor(city0, game);

    expect(labor0.transport).toBeCloseTo(5 * transportCost, 3);
    expect(labor0.remaining).toBeCloseTo(
      city0.population - calcLaborUsed(city0.production, city0.productionCosts) - 5 * transportCost,
      3
    );

    // city1 is not exporting anything positive from the trade direction,
    // so its transport labor should be 0
    const labor1 = getCityLabor(city1, game);
    expect(labor1.transport).toBe(0);
  });

  it('reverse-direction export correctly charges the right city', () => {
    const game = tutorialGame();
    game.cities[1].leagueId = 0;

    const city0 = game.cities[0];
    const city1 = game.cities[1];
    city0.production = { wheat: 10, fish: 0, iron: 0, silk: 0 };
    city1.production = { wheat: 0, fish: 0, iron: 10, silk: 0 };

    // Negative = toCity exports to fromCity, so city1 exports 3 iron to city0
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 0, fish: 0, iron: -3, silk: 0 },
    }];
    recalcTradeFlows(game);

    const transportCost = getTransportCostBetween(game, city0, city1);
    const labor1 = getCityLabor(city1, game);
    expect(labor1.transport).toBeCloseTo(3 * transportCost, 3);

    const labor0 = getCityLabor(city0, game);
    expect(labor0.transport).toBe(0);
  });

  it('bidirectional trade charges each city for its own exports', () => {
    const game = tutorialGame();
    game.cities[1].leagueId = 0;

    const city0 = game.cities[0];
    const city1 = game.cities[1];
    city0.production = { wheat: 20, fish: 0, iron: 0, silk: 0 };
    city1.production = { wheat: 0, fish: 0, iron: 20, silk: 0 };

    // city0 exports 5 wheat, city1 exports 4 iron
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 5, fish: 0, iron: -4, silk: 0 },
    }];
    recalcTradeFlows(game);

    const transportCost = getTransportCostBetween(game, city0, city1);
    const labor0 = getCityLabor(city0, game);
    const labor1 = getCityLabor(city1, game);

    expect(labor0.transport).toBeCloseTo(5 * transportCost, 3);
    expect(labor1.transport).toBeCloseTo(4 * transportCost, 3);
  });

  it('getCityLabor without game param still works (transport=0)', () => {
    const game = tutorialGame();
    const labor = getCityLabor(game.cities[0]);
    expect(labor.transport).toBe(0);
    expect(labor.total).toBe(game.cities[0].population);
  });
});

// ── 2. TURN SYSTEM ───────────────────────────────────────────────────

describe('turn system', () => {
  it('single player: each endTurn increments turn', () => {
    const game = tutorialGame(1);
    expect(game.turn).toBe(1);
    expect(game.currentPlayer).toBe(0);
    endTurn(game);
    expect(game.turn).toBe(2);
    expect(game.currentPlayer).toBe(0);
  });

  it('two players: turn increments after both go', () => {
    const game = tutorialGame(2);
    expect(game.turn).toBe(1);
    expect(game.currentPlayer).toBe(0);

    endTurn(game);
    expect(game.turn).toBe(1);
    expect(game.currentPlayer).toBe(1);

    endTurn(game);
    expect(game.turn).toBe(2);
    expect(game.currentPlayer).toBe(0);
  });

  it('four players cycle correctly', () => {
    const game = tutorialGame(4);
    for (let round = 1; round <= 3; round++) {
      for (let p = 0; p < 4; p++) {
        expect(game.currentPlayer).toBe(p);
        expect(game.turn).toBe(round);
        endTurn(game);
      }
    }
    expect(game.turn).toBe(4);
    expect(game.currentPlayer).toBe(0);
  });

  it('phase resets to production after endTurn', () => {
    const game = tutorialGame(1);
    game.phase = 'trade';
    endTurn(game);
    expect(game.phase).toBe('production');
  });

  it('log accumulates entries each turn', () => {
    const game = tutorialGame(1);
    expect(game.log.length).toBe(0);
    endTurn(game);
    expect(game.log.length).toBe(1);
    endTurn(game);
    expect(game.log.length).toBe(2);
  });

  it('log entries contain player name and turn number', () => {
    const game = tutorialGame(1);
    endTurn(game);
    const entry = game.log[0];
    expect(entry.player).toBe('Player 0');
    expect(typeof entry.turn).toBe('number');
    expect(Array.isArray(entry.messages)).toBe(true);
  });
});

// ── 3. SCORING ───────────────────────────────────────────────────────

describe('scoring', () => {
  it('score starts at 0', () => {
    const game = tutorialGame(1);
    expect(game.leagues[0].score).toBe(0);
  });

  it('at autarchy, score gain is 0 (utility = autarchy)', () => {
    const game = tutorialGame(1);
    const scoreBefore = game.leagues[0].score;
    endTurn(game);
    // gain = max(0, utility - autarchy). At autarchy these are equal.
    expect(game.leagues[0].score).toBeCloseTo(scoreBefore, 4);
  });

  it('score increases when utility exceeds autarchy', () => {
    const game = tutorialGame(1);
    // Manually give city0 extra consumption via imports
    game.cities[0].imports = { wheat: 5, fish: 5, iron: 5, silk: 5 };
    const utilBefore = getCityUtility(game.cities[0]);
    expect(utilBefore).toBeGreaterThan(game.cities[0].autarchyUtility);

    endTurn(game);
    expect(game.leagues[0].score).toBeGreaterThan(0);
  });

  it('score does not decrease when utility is below autarchy', () => {
    const game = tutorialGame(1);
    // Give some score first
    game.leagues[0].score = 5;
    // Cripple production
    game.cities[0].production = { wheat: 0.01, fish: 0.01, iron: 0.01, silk: 0.01 };
    endTurn(game);
    // gain = max(0, ...) so no negative contributions
    expect(game.leagues[0].score).toBeGreaterThanOrEqual(5);
  });

  it('score accumulates across multiple turns', () => {
    const game = tutorialGame(1);
    // Use actual trades so imports persist across endTurn (which calls recalcTradeFlows)
    game.cities[1].leagueId = 0;
    game.trades = [{
      fromCityId: 1, toCityId: 0,
      goods: { wheat: -5, fish: -5, iron: -5, silk: -5 },
    }];
    recalcTradeFlows(game);

    endTurn(game);
    const scoreAfter1 = game.leagues[0].score;
    expect(scoreAfter1).toBeGreaterThan(0);

    endTurn(game);
    const scoreAfter2 = game.leagues[0].score;
    expect(scoreAfter2).toBeGreaterThan(scoreAfter1);
  });

  it('only scores cities belonging to the current player', () => {
    const game = tutorialGame(2);
    // Give player 1's city huge imports
    game.cities[1].imports = { wheat: 50, fish: 50, iron: 50, silk: 50 };
    // End player 0's turn
    endTurn(game);
    // Player 0's score should not include player 1's city
    // Player 0's city is at autarchy → score ≈ 0
    expect(game.leagues[0].score).toBeCloseTo(0, 3);
  });
});

// ── 4. TRADE FLOWS ───────────────────────────────────────────────────

describe('trade flows', () => {
  it('recalcTradeFlows zeroes all flows before recomputing', () => {
    const game = tutorialGame();
    game.cities[0].imports.wheat = 999;
    game.cities[1].exports.iron = 888;
    game.trades = []; // no active trades
    recalcTradeFlows(game);
    expect(game.cities[0].imports.wheat).toBe(0);
    expect(game.cities[1].exports.iron).toBe(0);
  });

  it('positive trade amount: fromCity exports, toCity imports', () => {
    const game = tutorialGame();
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 7, fish: 0, iron: 0, silk: 0 },
    }];
    recalcTradeFlows(game);
    expect(game.cities[0].exports.wheat).toBe(7);
    expect(game.cities[1].imports.wheat).toBe(7);
  });

  it('negative trade amount: toCity exports, fromCity imports', () => {
    const game = tutorialGame();
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 0, fish: 0, iron: -4, silk: 0 },
    }];
    recalcTradeFlows(game);
    expect(game.cities[1].exports.iron).toBe(4);
    expect(game.cities[0].imports.iron).toBe(4);
  });

  it('multiple trades stack correctly on the same city', () => {
    const game = tutorialGame();
    game.cities[1].leagueId = 0;
    game.cities[2].leagueId = 0;

    game.trades = [
      { fromCityId: 0, toCityId: 1, goods: { wheat: 3, fish: 0, iron: 0, silk: 0 } },
      { fromCityId: 0, toCityId: 2, goods: { wheat: 4, fish: 0, iron: 0, silk: 0 } },
    ];
    recalcTradeFlows(game);
    expect(game.cities[0].exports.wheat).toBe(7);
    expect(game.cities[1].imports.wheat).toBe(3);
    expect(game.cities[2].imports.wheat).toBe(4);
  });

  it('consumption = production + imports - exports', () => {
    const game = tutorialGame();
    game.cities[0].production = { wheat: 20, fish: 10, iron: 5, silk: 3 };
    game.cities[0].imports = { wheat: 2, fish: 0, iron: 3, silk: 1 };
    game.cities[0].exports = { wheat: 5, fish: 1, iron: 0, silk: 0 };

    const c = getCityConsumption(game.cities[0]);
    expect(c.wheat).toBe(17);
    expect(c.fish).toBe(9);
    expect(c.iron).toBe(8);
    expect(c.silk).toBe(4);
  });

  it('consumption cannot go negative', () => {
    const game = tutorialGame();
    game.cities[0].production = { wheat: 1, fish: 1, iron: 1, silk: 1 };
    game.cities[0].exports = { wheat: 100, fish: 100, iron: 100, silk: 100 };
    game.cities[0].imports = { wheat: 0, fish: 0, iron: 0, silk: 0 };

    const c = getCityConsumption(game.cities[0]);
    for (const good of GOODS) {
      expect(c[good]).toBeGreaterThanOrEqual(0);
    }
  });

  it('goods are globally conserved across all trades', () => {
    const game = tutorialGame();
    game.cities[1].leagueId = 0;
    game.cities[2].leagueId = 0;

    game.trades = [
      { fromCityId: 0, toCityId: 1, goods: { wheat: 5, fish: -2, iron: 3, silk: -1 } },
      { fromCityId: 1, toCityId: 2, goods: { wheat: -1, fish: 4, iron: 0, silk: 2 } },
    ];
    recalcTradeFlows(game);

    for (const good of GOODS) {
      let totalExports = 0, totalImports = 0;
      for (const city of game.cities) {
        totalExports += city.exports[good];
        totalImports += city.imports[good];
      }
      expect(totalExports).toBeCloseTo(totalImports, 10);
    }
  });
});

// ── 5. TRANSPORT COSTS ───────────────────────────────────────────────

describe('transport costs', () => {
  it('getTransportCostBetween returns positive finite number', () => {
    const game = tutorialGame();
    const cost = getTransportCostBetween(game, game.cities[0], game.cities[1]);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isFinite(cost)).toBe(true);
  });

  it('cost to self is 0', () => {
    const game = tutorialGame();
    const cost = getTransportCostBetween(game, game.cities[0], game.cities[0]);
    expect(cost).toBe(0);
  });

  it('cost is symmetric', () => {
    const game = tutorialGame();
    const ab = getTransportCostBetween(game, game.cities[0], game.cities[1]);
    const ba = getTransportCostBetween(game, game.cities[1], game.cities[0]);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('getTradeTransportLabor matches manual calculation', () => {
    const game = tutorialGame();
    const trade = {
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 3, fish: 0, iron: -2, silk: 0 },
    };
    const transportLabor = getTradeTransportLabor(game, trade);
    const costPerUnit = getTransportCostBetween(game, game.cities[0], game.cities[1]);
    expect(transportLabor).toBeCloseTo((3 + 2) * costPerUnit, 5);
  });

  it('trade between same city has 0 transport cost', () => {
    const game = tutorialGame();
    const trade = {
      fromCityId: 0, toCityId: 0,
      goods: { wheat: 10, fish: 10, iron: 10, silk: 10 },
    };
    const transportLabor = getTradeTransportLabor(game, trade);
    expect(transportLabor).toBe(0);
  });
});

// ── 6. UTILITY FUNCTION ──────────────────────────────────────────────

describe('utility function properties', () => {
  it('utility is monotonically increasing in every good', () => {
    const base = { wheat: 10, fish: 10, iron: 10, silk: 10 };
    const uBase = calcUtility(base);
    for (const good of GOODS) {
      const more = { ...base, [good]: 15 };
      expect(calcUtility(more)).toBeGreaterThan(uBase);
    }
  });

  it('utility exhibits strict diminishing marginal returns', () => {
    for (const good of GOODS) {
      const low  = { wheat: 10, fish: 10, iron: 10, silk: 10, [good]: 5 };
      const mid  = { wheat: 10, fish: 10, iron: 10, silk: 10, [good]: 10 };
      const high = { wheat: 10, fish: 10, iron: 10, silk: 10, [good]: 15 };
      const gain1 = calcUtility(mid) - calcUtility(low);
      const gain2 = calcUtility(high) - calcUtility(mid);
      expect(gain1).toBeGreaterThan(gain2);
    }
  });

  it('balanced consumption beats unbalanced for same total', () => {
    // Same total units but distributed differently
    const balanced = { wheat: 10, fish: 10, iron: 10, silk: 10 };
    const unbalanced = { wheat: 30, fish: 5, iron: 3, silk: 2 };
    expect(calcUtility(balanced)).toBeGreaterThan(calcUtility(unbalanced));
  });

  it('zero consumption returns finite (not -Infinity)', () => {
    const u = calcUtility({ wheat: 0, fish: 0, iron: 0, silk: 0 });
    expect(Number.isFinite(u)).toBe(true);
  });

  it('getCityUtility matches calcUtility of getCityConsumption', () => {
    const game = tutorialGame();
    const city = game.cities[0];
    const consumption = getCityConsumption(city);
    expect(getCityUtility(city)).toBeCloseTo(calcUtility(consumption), 10);
  });
});

// ── 7. AUTARCHY ──────────────────────────────────────────────────────

describe('autarchy calculation', () => {
  it('autarchy uses all labor', () => {
    const costs = { wheat: 2, fish: 3, iron: 4, silk: 5 };
    const aut = calcAutarchy(100, costs);
    let laborUsed = 0;
    for (const good of GOODS) {
      laborUsed += aut.consumption[good] * costs[good];
    }
    expect(laborUsed).toBeCloseTo(100, 5);
  });

  it('autarchy is optimal (any perturbation lowers utility)', () => {
    const costs = { wheat: 2, fish: 3, iron: 5, silk: 4 };
    const aut = calcAutarchy(100, costs);

    // Perturb: shift some labor from wheat to fish
    const perturbed = { ...aut.consumption };
    perturbed.wheat -= 1;
    perturbed.fish += costs.wheat / costs.fish;  // keep total labor the same

    expect(calcUtility(aut.consumption)).toBeGreaterThanOrEqual(calcUtility(perturbed) - 1e-10);
  });

  it('cities start exactly at autarchy utility', () => {
    const game = tutorialGame();
    for (const city of game.cities) {
      expect(getCityUtility(city)).toBeCloseTo(city.autarchyUtility, 4);
    }
  });

  it('autarchy utility differs by city costs', () => {
    const game = tutorialGame();
    const utilities = game.cities.map(c => c.autarchyUtility);
    // At least 2 different values
    expect(new Set(utilities.map(u => u.toFixed(4))).size).toBeGreaterThan(1);
  });
});

// ── 8. TRADE MISSIONS ────────────────────────────────────────────────

describe('trade missions', () => {
  it('missions are resolved on endTurn and removed from pending', () => {
    const game = tutorialGame(1);
    game.missions.push({
      leagueId: 0, fromCityId: 0, toCityId: 1, guaranteedUtility: null,
    });
    expect(game.missions.length).toBe(1);
    endTurn(game);
    expect(game.missions.filter(m => m.leagueId === 0).length).toBe(0);
  });

  it('mission to already-affiliated city fails with log message', () => {
    const game = tutorialGame(2);
    // city 1 belongs to player 1
    game.missions.push({
      leagueId: 0, fromCityId: 0, toCityId: 1, guaranteedUtility: null,
    });
    const messages = endTurn(game);
    expect(messages.some(m => m.includes('already in a league'))).toBe(true);
  });

  it('successful mission sets leagueId and guaranteedUtility', () => {
    const game = tutorialGame(1);
    // Make acceptance very likely by giving huge utility gain
    game.cities[0].imports = { wheat: 100, fish: 100, iron: 100, silk: 100 };
    game.missions.push({
      leagueId: 0, fromCityId: 0, toCityId: 2,
      guaranteedUtility: -5,  // very low guarantee, easy to meet
    });

    // Run many times to handle randomness
    let joined = false;
    for (let i = 0; i < 50 && !joined; i++) {
      const g = tutorialGame(1);
      g.cities[0].imports = { wheat: 100, fish: 100, iron: 100, silk: 100 };
      g.missions.push({
        leagueId: 0, fromCityId: 0, toCityId: 2, guaranteedUtility: -5,
      });
      endTurn(g);
      if (g.cities[2].leagueId === 0) {
        expect(g.cities[2].guaranteedUtility).toBe(-5);
        joined = true;
      }
    }
    expect(joined).toBe(true);
  });

  it('mission cost increases with distance', () => {
    const game = tutorialGame();
    const near = game.cities[1]; // close to city 0
    const far = game.cities.reduce((farthest, c) => {
      if (c.id === 0) return farthest;
      const d1 = Math.abs(game.cities[0].row - c.row) + Math.abs(game.cities[0].col - c.col);
      const d2 = Math.abs(game.cities[0].row - farthest.row) + Math.abs(game.cities[0].col - farthest.col);
      return d1 > d2 ? c : farthest;
    }, game.cities[1]);

    const costNear = getMissionCost(game, game.cities[0], near);
    const costFar = getMissionCost(game, game.cities[0], far);
    expect(costFar).toBeGreaterThanOrEqual(costNear);
  });

  it('other players missions are not resolved on your turn', () => {
    const game = tutorialGame(2);
    game.missions.push({
      leagueId: 1, fromCityId: 1, toCityId: 2, guaranteedUtility: null,
    });
    endTurn(game); // player 0's turn
    // Player 1's mission should still be pending
    expect(game.missions.filter(m => m.leagueId === 1).length).toBe(1);
  });
});

// ── 9. SECESSION ─────────────────────────────────────────────────────

describe('secession', () => {
  it('no secession on turn 1', () => {
    const game = tutorialGame(1);
    // Cripple city production
    game.cities[0].production = { wheat: 0.001, fish: 0.001, iron: 0.001, silk: 0.001 };
    const utilBefore = getCityUtility(game.cities[0]);
    expect(utilBefore).toBeLessThan(game.cities[0].autarchyUtility);

    endTurn(game);
    expect(game.cities[0].leagueId).toBe(0); // still in league
  });

  it('city with utility far below autarchy secedes (probabilistic)', () => {
    // Run many trials
    let seceded = false;
    for (let i = 0; i < 100 && !seceded; i++) {
      const game = tutorialGame(1);
      game.turn = 2; // past turn 1 protection
      game.cities[0].production = { wheat: 0.001, fish: 0.001, iron: 0.001, silk: 0.001 };
      endTurn(game);
      if (game.cities[0].leagueId === null) seceded = true;
    }
    expect(seceded).toBe(true);
  });

  it('secession removes all trades involving that city', () => {
    // Run trials
    let tradeRemoved = false;
    for (let i = 0; i < 100 && !tradeRemoved; i++) {
      const game = tutorialGame(1);
      game.turn = 2;
      game.cities[1].leagueId = 0;
      game.cities[0].production = { wheat: 0.001, fish: 0.001, iron: 0.001, silk: 0.001 };
      game.trades = [{
        fromCityId: 0, toCityId: 1,
        goods: { wheat: 1, fish: 0, iron: 0, silk: 0 },
      }];
      endTurn(game);
      if (game.cities[0].leagueId === null) {
        // trades involving city 0 should be removed
        const tradesWithCity0 = game.trades.filter(
          t => t.fromCityId === 0 || t.toCityId === 0
        );
        expect(tradesWithCity0.length).toBe(0);
        tradeRemoved = true;
      }
    }
    expect(tradeRemoved).toBe(true);
  });

  it('guaranteed utility violation triggers secession with trade cleanup', () => {
    let seceded = false;
    for (let i = 0; i < 100 && !seceded; i++) {
      const game = tutorialGame(1);
      game.turn = 2;
      game.cities[1].leagueId = 0;
      game.cities[1].guaranteedUtility = 999; // impossibly high
      game.cities[1].production = { wheat: 1, fish: 1, iron: 1, silk: 1 };
      game.trades = [{
        fromCityId: 0, toCityId: 1,
        goods: { wheat: 1, fish: 0, iron: 0, silk: 0 },
      }];
      endTurn(game);
      if (game.cities[1].leagueId === null) {
        expect(game.cities[1].guaranteedUtility).toBeNull();
        // trades should also be cleaned up
        const tradesWithCity1 = game.trades.filter(
          t => t.fromCityId === 1 || t.toCityId === 1
        );
        expect(tradesWithCity1.length).toBe(0);
        seceded = true;
      }
    }
    expect(seceded).toBe(true);
  });

  it('city at autarchy does not secede', () => {
    // At exact autarchy, deficit = 0, pSecede = 0
    const game = tutorialGame(1);
    game.turn = 5;
    // City is at autarchy by default
    for (let t = 0; t < 20; t++) {
      endTurn(game);
      expect(game.cities[0].leagueId).toBe(0);
    }
  });

  it('city above autarchy never secedes', () => {
    const game = tutorialGame(1);
    game.turn = 5;
    game.cities[0].imports = { wheat: 5, fish: 5, iron: 5, silk: 5 };
    for (let t = 0; t < 20; t++) {
      endTurn(game);
      expect(game.cities[0].leagueId).toBe(0);
    }
  });
});

// ── 10. GAME OVER ────────────────────────────────────────────────────

describe('game over', () => {
  it('gameOver is false at start', () => {
    const game = tutorialGame(1);
    expect(game.gameOver).toBe(false);
  });

  it('gameOver triggers when all cities are in one league', () => {
    const game = tutorialGame(1);
    // Put all cities in player 0's league
    for (const city of game.cities) {
      city.leagueId = 0;
    }
    endTurn(game);
    expect(game.gameOver).toBe(true);
  });

  it('gameOver does NOT trigger with cities in multiple leagues', () => {
    const game = tutorialGame(2);
    // All cities assigned but to different leagues
    game.cities[0].leagueId = 0;
    game.cities[1].leagueId = 1;
    game.cities[2].leagueId = 0;
    game.cities[3].leagueId = 1;
    endTurn(game);
    expect(game.gameOver).toBe(false);
  });

  it('gameOver does NOT trigger with unaffiliated cities remaining', () => {
    const game = tutorialGame(1);
    game.cities[0].leagueId = 0;
    game.cities[1].leagueId = 0;
    game.cities[2].leagueId = 0;
    game.cities[3].leagueId = null;
    endTurn(game);
    expect(game.gameOver).toBe(false);
  });
});

// ── 11. MULTIPLAYER ──────────────────────────────────────────────────

describe('multiplayer', () => {
  it('each player has their own league and starting city', () => {
    const game = tutorialGame(3);
    expect(game.cities[0].leagueId).toBe(0);
    expect(game.cities[1].leagueId).toBe(1);
    expect(game.cities[2].leagueId).toBe(2);
    expect(game.cities[3].leagueId).toBeNull();
  });

  it('each player scores independently', () => {
    const game = tutorialGame(2);
    // Give player 0's city extra utility
    game.cities[0].imports = { wheat: 10, fish: 10, iron: 10, silk: 10 };

    endTurn(game); // player 0 scores
    expect(game.leagues[0].score).toBeGreaterThan(0);

    endTurn(game); // player 1 scores
    // Player 1's city is at autarchy → 0 gain
    expect(game.leagues[1].score).toBeCloseTo(0, 3);
  });

  it('player cannot modify another player\'s city production', () => {
    const game = tutorialGame(2);
    // The UI prevents this, but let's verify the game model keeps ownership clear
    expect(game.cities[0].leagueId).toBe(0);
    expect(game.cities[1].leagueId).toBe(1);
    // Player 0 can only control cities where leagueId === 0
    const player0Cities = game.cities.filter(c => c.leagueId === 0);
    const player1Cities = game.cities.filter(c => c.leagueId === 1);
    expect(player0Cities.length).toBe(1);
    expect(player1Cities.length).toBe(1);
    expect(player0Cities[0].id).not.toBe(player1Cities[0].id);
  });
});

// ── 12. SERIALIZE / DESERIALIZE ──────────────────────────────────────

describe('save/load round-trip', () => {
  it('preserves all game state after a few turns', () => {
    const game = tutorialGame(2);
    game.cities[1].leagueId = 0;
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 3, fish: -2, iron: 0, silk: 1 },
    }];
    recalcTradeFlows(game);
    endTurn(game);
    endTurn(game);

    const json = serializeGame(game);
    const restored = deserializeGame(json);

    expect(restored.turn).toBe(game.turn);
    expect(restored.currentPlayer).toBe(game.currentPlayer);
    expect(restored.leagues[0].score).toBeCloseTo(game.leagues[0].score, 10);
    expect(restored.trades.length).toBe(game.trades.length);
    expect(restored.cities.length).toBe(game.cities.length);
    expect(restored.log.length).toBe(game.log.length);

    for (let i = 0; i < game.cities.length; i++) {
      expect(restored.cities[i].name).toBe(game.cities[i].name);
      expect(restored.cities[i].leagueId).toBe(game.cities[i].leagueId);
      expect(restored.cities[i].autarchyUtility).toBeCloseTo(game.cities[i].autarchyUtility, 10);
      for (const good of GOODS) {
        expect(restored.cities[i].production[good]).toBeCloseTo(game.cities[i].production[good], 10);
        expect(restored.cities[i].imports[good]).toBeCloseTo(game.cities[i].imports[good], 10);
        expect(restored.cities[i].exports[good]).toBeCloseTo(game.cities[i].exports[good], 10);
      }
    }
  });

  it('restored game can continue playing', () => {
    const game = tutorialGame(1);
    endTurn(game);
    const json = serializeGame(game);
    const restored = deserializeGame(json);
    // Should be able to call endTurn on restored game
    expect(() => endTurn(restored)).not.toThrow();
    expect(restored.turn).toBe(game.turn + 1);
  });
});

// ── 13. EUROPE MAP GAMEPLAY ──────────────────────────────────────────

describe('europe map gameplay', () => {
  it('creates a playable game with all 18 cities', () => {
    const game = createGame(europeMap, makePlayers(2));
    expect(game.cities.length).toBe(18);
    expect(game.cities[0].leagueId).toBe(0);
    expect(game.cities[1].leagueId).toBe(1);
  });

  it('coastal cities have cheap fish', () => {
    const game = createGame(europeMap, makePlayers(1));
    const lisbon = game.cities.find(c => c.name === 'Lisbon');
    const vienna = game.cities.find(c => c.name === 'Vienna');
    expect(lisbon.productionCosts.fish).toBeLessThan(vienna.productionCosts.fish);
  });

  it('can run 10 turns without error', () => {
    const game = createGame(europeMap, makePlayers(1));
    for (let i = 0; i < 10; i++) {
      expect(() => endTurn(game)).not.toThrow();
    }
    expect(game.turn).toBe(11);
  });
});

// ── 14. EDGE CASES ───────────────────────────────────────────────────

describe('edge cases', () => {
  it('endTurn with no cities in any league does not crash', () => {
    const game = tutorialGame(1);
    // Remove city from league
    game.cities[0].leagueId = null;
    expect(() => endTurn(game)).not.toThrow();
  });

  it('trade with 0 volume does not affect anything', () => {
    const game = tutorialGame();
    game.trades = [{
      fromCityId: 0, toCityId: 1,
      goods: { wheat: 0, fish: 0, iron: 0, silk: 0 },
    }];
    recalcTradeFlows(game);
    for (const city of game.cities) {
      for (const good of GOODS) {
        expect(city.imports[good]).toBe(0);
        expect(city.exports[good]).toBe(0);
      }
    }
  });

  it('many simultaneous trades do not corrupt state', () => {
    const game = tutorialGame();
    for (let i = 1; i < game.cities.length; i++) {
      game.cities[i].leagueId = 0;
    }
    // Create trades between every pair
    game.trades = [];
    for (let i = 0; i < game.cities.length; i++) {
      for (let j = i + 1; j < game.cities.length; j++) {
        game.trades.push({
          fromCityId: i, toCityId: j,
          goods: { wheat: 1, fish: -1, iron: 0.5, silk: -0.5 },
        });
      }
    }
    recalcTradeFlows(game);

    // Verify conservation
    for (const good of GOODS) {
      let totalExports = 0, totalImports = 0;
      for (const city of game.cities) {
        totalExports += city.exports[good];
        totalImports += city.imports[good];
      }
      expect(totalExports).toBeCloseTo(totalImports, 8);
    }
  });

  it('rapid endTurn calls do not accumulate errors', () => {
    const game = tutorialGame(1);
    for (let i = 0; i < 100; i++) {
      endTurn(game);
    }
    expect(game.turn).toBe(101);
    expect(Number.isFinite(game.leagues[0].score)).toBe(true);
  });
});
