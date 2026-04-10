/**
 * Trade Panel: trade window between two cities.
 * Sliders adjust flow of each good. Shows transport cost and utility updates in real-time.
 */

import { GOODS } from '../utils/economics';
import { getCityUtility, getCityConsumption, getTransportCostBetween } from '../models/Game';

const GOOD_ICONS = { wheat: '\u{1F33E}', fish: '\u{1F41F}', iron: '\u2692\uFE0F', silk: '\u{1F9F5}' };

export default function TradePanel({ cityA, cityB, trade, game, onTradeChange, onClose, onRemoveTrade }) {
  if (!cityA || !cityB) return null;

  const transportCostPerUnit = getTransportCostBetween(game, cityA, cityB);

  // Calculate total transport labor
  let totalVolume = 0;
  if (trade) {
    for (const good of GOODS) {
      totalVolume += Math.abs(trade.goods[good] || 0);
    }
  }
  const totalTransportLabor = totalVolume * transportCostPerUnit;

  const utilityA = getCityUtility(cityA);
  const utilityB = getCityUtility(cityB);
  const consumptionA = getCityConsumption(cityA);
  const consumptionB = getCityConsumption(cityB);

  const handleGoodChange = (good, value) => {
    const newGoods = { ...(trade?.goods || { wheat: 0, fish: 0, iron: 0, silk: 0 }) };
    newGoods[good] = parseFloat(value);
    onTradeChange(cityA.id, cityB.id, newGoods);
  };

  // Determine max tradeable amount (limited by production)
  const maxTrade = (good) => {
    const prodA = cityA.production[good] || 0;
    const prodB = cityB.production[good] || 0;
    return Math.max(prodA, prodB);
  };

  const bothInLeague = cityA.leagueId === game.currentPlayer && cityB.leagueId === game.currentPlayer;

  return (
    <div className="panel trade-panel">
      <div className="panel-header">
        <h3>Trade: {cityA.name} ↔ {cityB.name}</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="trade-info">
        <div className="trade-transport">
          Transport cost: <strong>{transportCostPerUnit.toFixed(1)}</strong> labor/unit
          | Total: <strong>{totalTransportLabor.toFixed(1)}</strong> labor
        </div>
      </div>

      <div className="trade-cities-header">
        <div className="trade-city-label">{cityA.name}</div>
        <div className="trade-city-label center">Flow</div>
        <div className="trade-city-label">{cityB.name}</div>
      </div>

      {GOODS.map(good => {
        const amount = trade?.goods[good] || 0;
        const max = maxTrade(good);

        return (
          <div key={good} className="trade-good-row">
            <div className="trade-good-city">
              <div className="trade-good-amount" style={{ color: amount > 0 ? '#8b2500' : amount < 0 ? '#3a7d44' : '#7a6e5d' }}>
                {amount > 0 ? `-${amount.toFixed(1)}` : amount < 0 ? `+${(-amount).toFixed(1)}` : '0'}
              </div>
              <div className="trade-good-consumed">= {consumptionA[good].toFixed(1)}</div>
            </div>
            <div className="trade-good-slider">
              <span className="good-icon">{GOOD_ICONS[good]}</span>
              <input
                type="range"
                min={-max}
                max={max}
                step="0.1"
                value={amount}
                onChange={(e) => handleGoodChange(good, e.target.value)}
                disabled={!bothInLeague}
              />
              <div className="trade-flow-label">
                {amount > 0 ? `→ ${amount.toFixed(1)}` : amount < 0 ? `${(-amount).toFixed(1)} ←` : '—'}
              </div>
            </div>
            <div className="trade-good-city">
              <div className="trade-good-amount" style={{ color: amount < 0 ? '#8b2500' : amount > 0 ? '#3a7d44' : '#7a6e5d' }}>
                {amount < 0 ? `-${(-amount).toFixed(1)}` : amount > 0 ? `+${amount.toFixed(1)}` : '0'}
              </div>
              <div className="trade-good-consumed">= {consumptionB[good].toFixed(1)}</div>
            </div>
          </div>
        );
      })}

      <div className="trade-utility-compare">
        <div className="trade-utility-city">
          <div className="trade-utility-label">{cityA.name} Utility</div>
          <div className="trade-utility-value" style={{ color: utilityA >= cityA.autarchyUtility ? '#3a7d44' : '#8b2500' }}>
            {utilityA.toFixed(3)}
          </div>
          <div className="trade-utility-autarchy">Autarchy: {cityA.autarchyUtility.toFixed(3)}</div>
          <div className="trade-utility-gain" style={{ color: utilityA - cityA.autarchyUtility >= 0 ? '#3a7d44' : '#8b2500' }}>
            {utilityA - cityA.autarchyUtility >= 0 ? '+' : ''}{(utilityA - cityA.autarchyUtility).toFixed(3)}
          </div>
        </div>
        <div className="trade-utility-city">
          <div className="trade-utility-label">{cityB.name} Utility</div>
          <div className="trade-utility-value" style={{ color: utilityB >= cityB.autarchyUtility ? '#3a7d44' : '#8b2500' }}>
            {utilityB.toFixed(3)}
          </div>
          <div className="trade-utility-autarchy">Autarchy: {cityB.autarchyUtility.toFixed(3)}</div>
          <div className="trade-utility-gain" style={{ color: utilityB - cityB.autarchyUtility >= 0 ? '#3a7d44' : '#8b2500' }}>
            {utilityB - cityB.autarchyUtility >= 0 ? '+' : ''}{(utilityB - cityB.autarchyUtility).toFixed(3)}
          </div>
        </div>
      </div>

      {trade && (
        <button className="btn btn-danger" onClick={() => onRemoveTrade(cityA.id, cityB.id)}>
          Remove Trade Route
        </button>
      )}

      {!bothInLeague && (
        <div className="panel-notice">Both cities must be in your league to trade.</div>
      )}
    </div>
  );
}
