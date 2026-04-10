/**
 * Production Panel: per-city production allocation UI.
 * Shows sliders for each good, labor usage, utility vs autarchy.
 */

import { GOODS } from '../utils/economics';
import { getCityUtility, getCityConsumption, getCityLabor } from '../models/Game';

const GOOD_ICONS = { wheat: '\u{1F33E}', fish: '\u{1F41F}', iron: '\u2692\uFE0F', silk: '\u{1F9F5}' };
const GOOD_COLORS = { wheat: '#9e7c1a', fish: '#2e6b8a', iron: '#5a5a5a', silk: '#7b4a8a' };

export default function ProductionPanel({ city, game, onProductionChange, onClose }) {
  if (!city) return null;

  const labor = getCityLabor(city, game);
  const consumption = getCityConsumption(city);
  const utility = getCityUtility(city);
  const isOwned = city.leagueId === game.currentPlayer;

  const availableLabor = city.population - labor.transport;

  const handleSliderChange = (good, value) => {
    if (!isOwned) return;
    const newProduction = { ...city.production };
    newProduction[good] = parseFloat(value);

    // If over budget, proportionally scale down the OTHER goods to fit
    let totalLabor = 0;
    for (const g of GOODS) {
      totalLabor += newProduction[g] * city.productionCosts[g];
    }

    if (totalLabor > availableLabor * 1.001) {
      const thisLabor = newProduction[good] * city.productionCosts[good];
      const otherLabor = totalLabor - thisLabor;
      const otherBudget = Math.max(0, availableLabor - thisLabor);

      if (otherLabor > 0) {
        const scale = otherBudget / otherLabor;
        for (const g of GOODS) {
          if (g !== good) {
            newProduction[g] = city.production[g] * scale;
          }
        }
      }
    }

    onProductionChange(city.id, newProduction);
  };

  const maxProduction = (good) => {
    let otherLabor = 0;
    for (const g of GOODS) {
      if (g !== good) otherLabor += city.production[g] * city.productionCosts[g];
    }
    const remaining = availableLabor - otherLabor;
    return Math.max(0, remaining / city.productionCosts[good]);
  };

  return (
    <div className="panel production-panel">
      <div className="panel-header">
        <h3>{city.name}</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="panel-stats">
        <div className="stat">
          <span className="stat-label">Population</span>
          <span className="stat-value">{city.population}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Production</span>
          <span className="stat-value">{labor.production.toFixed(1)}</span>
        </div>
        {labor.transport > 0 && (
          <div className="stat">
            <span className="stat-label">Transport</span>
            <span className="stat-value">{labor.transport.toFixed(1)}</span>
          </div>
        )}
        <div className="stat">
          <span className="stat-label">Remaining</span>
          <span className="stat-value" style={{ color: labor.remaining < 1 ? '#8b2500' : '#3a7d44' }}>
            {labor.remaining.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Utility display */}
      <div className="utility-display">
        <div className="utility-bar-container">
          <div className="utility-bar-label">
            Utility: <strong>{utility.toFixed(3)}</strong>
          </div>
          <div className="utility-bar-bg">
            <div
              className="utility-bar-fill"
              style={{
                width: `${Math.max(0, Math.min(100, ((utility - city.autarchyUtility * 0.5) / (city.autarchyUtility * 1.5 - city.autarchyUtility * 0.5)) * 100))}%`,
                backgroundColor: utility >= city.autarchyUtility ? '#3a7d44' : '#8b2500',
              }}
            />
            <div
              className="utility-bar-marker"
              style={{
                left: `${((city.autarchyUtility - city.autarchyUtility * 0.5) / (city.autarchyUtility * 1.5 - city.autarchyUtility * 0.5)) * 100}%`,
              }}
              title={`Autarchy: ${city.autarchyUtility.toFixed(3)}`}
            />
            {city.guaranteedUtility && (
              <div
                className="utility-bar-marker guaranteed"
                style={{
                  left: `${((city.guaranteedUtility - city.autarchyUtility * 0.5) / (city.autarchyUtility * 1.5 - city.autarchyUtility * 0.5)) * 100}%`,
                }}
                title={`Guaranteed: ${city.guaranteedUtility.toFixed(3)}`}
              />
            )}
          </div>
          <div className="utility-bar-labels">
            <span>Autarchy: {city.autarchyUtility.toFixed(3)}</span>
            {city.guaranteedUtility && <span>Guaranteed: {city.guaranteedUtility.toFixed(3)}</span>}
          </div>
        </div>
      </div>

      {/* Production sliders */}
      <div className="goods-grid">
        {GOODS.map(good => {
          const cost = city.productionCosts[good];
          const produced = city.production[good] || 0;
          const imported = city.imports[good] || 0;
          const exported = city.exports[good] || 0;
          const consumed = consumption[good];
          const max = maxProduction(good);

          return (
            <div key={good} className="good-row">
              <div className="good-header">
                <span className="good-icon" style={{ color: GOOD_COLORS[good] }}>
                  {GOOD_ICONS[good]} {good.charAt(0).toUpperCase() + good.slice(1)}
                </span>
                <span className="good-cost">{cost.toFixed(1)} labor/unit</span>
              </div>
              <div className="good-slider">
                <input
                  type="range"
                  min="0"
                  max={max}
                  step="0.1"
                  value={produced}
                  onChange={(e) => handleSliderChange(good, e.target.value)}
                  disabled={!isOwned}
                  style={{ accentColor: GOOD_COLORS[good] }}
                />
                <span className="good-amount">{produced.toFixed(1)}</span>
              </div>
              <div className="good-flows">
                <span title="Produced">P: {produced.toFixed(1)}</span>
                <span title="Imported" style={{ color: '#3a7d44' }}>+{imported.toFixed(1)}</span>
                <span title="Exported" style={{ color: '#8b2500' }}>-{exported.toFixed(1)}</span>
                <span title="Consumed"><strong>= {consumed.toFixed(1)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {!isOwned && (
        <div className="panel-notice">This city is not in your league. Production is read-only.</div>
      )}
    </div>
  );
}
