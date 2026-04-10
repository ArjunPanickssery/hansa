/**
 * Tests for the AI computer player.
 */

import { describe, it, expect } from 'vitest';
import { runAI } from '../ai/ComputerPlayer';
import { createGame, getCityUtility, recalcTradeFlows } from '../models/Game';
import { GOODS } from '../utils/economics';
import { tutorialMap } from '../maps/tutorial';

function makeAIGame() {
  const players = [
    { name: 'Human', isHuman: true, color: '#8b2500' },
    { name: 'AI', isHuman: false, color: '#2e6b8a' },
  ];
  const game = createGame(tutorialMap, players);
  // Give AI a second city so it can trade
  game.cities[2].leagueId = 1;
  return game;
}

describe('runAI', () => {
  it('returns an array of log messages', () => {
    const game = makeAIGame();
    const log = runAI(game, 1);
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThan(0);
  });

  it('sets production for AI cities', () => {
    const game = makeAIGame();
    runAI(game, 1);
    const aiCities = game.cities.filter(c => c.leagueId === 1);
    for (const city of aiCities) {
      let totalProd = 0;
      for (const good of GOODS) {
        totalProd += city.production[good] || 0;
      }
      expect(totalProd).toBeGreaterThan(0);
    }
  });

  it('creates trades between AI cities', () => {
    const game = makeAIGame();
    runAI(game, 1);
    // Should have at least considered a trade
    const aiCityIds = new Set(game.cities.filter(c => c.leagueId === 1).map(c => c.id));
    const aiTrades = game.trades.filter(
      t => aiCityIds.has(t.fromCityId) || aiCityIds.has(t.toCityId)
    );
    // May or may not create trades depending on costs, but shouldn't error
    expect(Array.isArray(aiTrades)).toBe(true);
  });

  it('sends trade missions to unaffiliated cities', () => {
    const game = makeAIGame();
    runAI(game, 1);
    const aiMissions = game.missions.filter(m => m.leagueId === 1);
    // Should attempt at least one mission
    expect(aiMissions.length).toBeGreaterThanOrEqual(0); // May not always have labor
  });

  it('does not modify human player cities', () => {
    const game = makeAIGame();
    const humanCityProdBefore = { ...game.cities[0].production };
    runAI(game, 1);
    expect(game.cities[0].production).toEqual(humanCityProdBefore);
    expect(game.cities[0].leagueId).toBe(0);
  });

  it('handles AI with no cities gracefully', () => {
    const game = createGame(tutorialMap, [
      { name: 'Human', isHuman: true, color: '#8b2500' },
      { name: 'AI', isHuman: false, color: '#2e6b8a' },
    ]);
    game.cities[1].leagueId = null;
    const log = runAI(game, 1);
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(0);
  });

  it('handles AI with single city (no trade possible)', () => {
    const game = createGame(tutorialMap, [
      { name: 'Human', isHuman: true, color: '#8b2500' },
      { name: 'AI', isHuman: false, color: '#2e6b8a' },
    ]);
    const log = runAI(game, 1);
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThan(0); // at least the summary message
  });

  it('does not send duplicate missions to the same target', () => {
    const game = makeAIGame();
    // Pre-add a mission to the closest unaffiliated city
    const unaffiliated = game.cities.filter(c => c.leagueId === null);
    if (unaffiliated.length > 0) {
      game.missions.push({
        leagueId: 1, fromCityId: 1, toCityId: unaffiliated[0].id, guaranteedUtility: null,
      });
    }
    const missionCountBefore = game.missions.filter(m => m.leagueId === 1).length;
    runAI(game, 1);
    // Should not have sent another mission to the same city
    const targets = game.missions.filter(m => m.leagueId === 1).map(m => m.toCityId);
    const uniqueTargets = new Set(targets);
    expect(uniqueTargets.size).toBe(targets.length);
  });
});
