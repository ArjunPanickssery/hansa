/**
 * Simple AI for computer-controlled leagues.
 * Returns an array of log messages.
 */

import { GOODS, calcAutarchy, calcUtility, calcLaborUsed } from '../utils/economics';
import {
  getCityUtility,
  getCityConsumption,
  getCityLabor,
  getTransportCostBetween,
  recalcTradeFlows,
  getMissionCost,
} from '../models/Game';

export function runAI(game, playerId) {
  const log = [];
  const league = game.leagues[playerId];
  const myCities = game.cities.filter(c => c.leagueId === playerId);
  if (myCities.length === 0) return log;

  // ── 1. Find a mission target ───────────────────────────────────────

  const unaffiliated = game.cities.filter(c => c.leagueId === null);
  const pendingTargets = new Set(
    game.missions.filter(m => m.leagueId === playerId).map(m => m.toCityId)
  );
  const availableTargets = unaffiliated.filter(c => !pendingTargets.has(c.id));

  let plannedMission = null;
  if (availableTargets.length > 0) {
    let bestDist = Infinity, bestTarget = null, bestFrom = null;
    for (const target of availableTargets) {
      for (const myCity of myCities) {
        const dist = Math.abs(myCity.row - target.row) + Math.abs(myCity.col - target.col);
        if (dist < bestDist) {
          bestDist = dist;
          bestTarget = target;
          bestFrom = myCity;
        }
      }
    }
    if (bestTarget && bestFrom) {
      const cost = getMissionCost(game, bestFrom, bestTarget);
      if (cost <= bestFrom.population * 0.08) {
        plannedMission = { from: bestFrom, to: bestTarget, cost };
      }
    }
  }

  // ── 2. Set production (reserve labor for mission) ──────────────────

  for (const city of myCities) {
    let prodLabor = city.population;
    if (plannedMission && plannedMission.from.id === city.id) {
      prodLabor -= plannedMission.cost;
    }
    const aut = calcAutarchy(prodLabor, city.productionCosts);
    for (const good of GOODS) {
      city.production[good] = aut.consumption[good];
    }
  }

  // ── 3. Set up trades between city pairs ────────────────────────────

  const myCityIds = new Set(myCities.map(c => c.id));
  game.trades = game.trades.filter(
    t => !myCityIds.has(t.fromCityId) && !myCityIds.has(t.toCityId)
  );

  let tradesCreated = 0;

  if (myCities.length >= 2) {
    for (let i = 0; i < myCities.length; i++) {
      for (let j = i + 1; j < myCities.length; j++) {
        const cityA = myCities[i];
        const cityB = myCities[j];
        const transportCost = getTransportCostBetween(game, cityA, cityB);
        if (!Number.isFinite(transportCost) || transportCost <= 0) continue;

        // Save state
        const prodA = { ...cityA.production };
        const prodB = { ...cityB.production };
        const utilA_before = getCityUtility(cityA);
        const utilB_before = getCityUtility(cityB);

        // Find goods where each city has comparative advantage.
        // For each good, compute cost ratio. If A is significantly cheaper,
        // A should export that good to B, and vice versa.
        const tradeGoods = { wheat: 0, fish: 0, iron: 0, silk: 0 };
        let hasAnyTrade = false;

        for (const good of GOODS) {
          const cA = cityA.productionCosts[good];
          const cB = cityB.productionCosts[good];
          const ratio = cA / cB;

          if (ratio < 0.80) {
            // A is cheaper → A exports to B
            const amount = cityA.production[good] * 0.08;
            if (amount > 0.3) {
              tradeGoods[good] = Math.round(amount * 10) / 10;
              hasAnyTrade = true;
            }
          } else if (ratio > 1.25) {
            // B is cheaper → B exports to A
            const amount = cityB.production[good] * 0.08;
            if (amount > 0.3) {
              tradeGoods[good] = -Math.round(amount * 10) / 10;
              hasAnyTrade = true;
            }
          }
        }

        if (!hasAnyTrade) continue;

        // Require bidirectional trade: at least one good flows each way.
        // Otherwise one city is just giving goods away.
        const hasAtoB = GOODS.some(g => tradeGoods[g] > 0);
        const hasBtoA = GOODS.some(g => tradeGoods[g] < 0);
        if (!hasAtoB || !hasBtoA) continue;

        // Check transport affordability: total export units * cost per unit
        let exportUnitsA = 0, exportUnitsB = 0;
        for (const g of GOODS) {
          if (tradeGoods[g] > 0) exportUnitsA += tradeGoods[g];
          if (tradeGoods[g] < 0) exportUnitsB += -tradeGoods[g];
        }
        if (exportUnitsA * transportCost > cityA.population * 0.25) continue;
        if (exportUnitsB * transportCost > cityB.population * 0.25) continue;

        // Apply the trade — transport is affordable, comparative advantage holds
        const trade = { fromCityId: cityA.id, toCityId: cityB.id, goods: tradeGoods };
        game.trades.push(trade);
        recalcTradeFlows(game);
        tradesCreated++;
      }
    }

    if (tradesCreated > 0) {
      log.push(`${league.name} set up ${tradesCreated} trade route(s).`);
    }
  }

  // ── 4. Send the planned mission ────────────────────────────────────

  if (plannedMission) {
    const labor = getCityLabor(plannedMission.from, game);
    if (labor.remaining >= plannedMission.cost) {
      game.missions.push({
        leagueId: playerId,
        fromCityId: plannedMission.from.id,
        toCityId: plannedMission.to.id,
        guaranteedUtility: null,
      });
      log.push(`${league.name} sent a trade mission from ${plannedMission.from.name} to ${plannedMission.to.name}.`);
    }
  }

  if (log.length === 0) {
    const names = myCities.map(c => c.name).join(', ');
    log.push(`${league.name} managed ${myCities.length} city(ies): ${names}.`);
  }

  return log;
}
