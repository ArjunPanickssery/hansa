/**
 * Trade Mission Panel: send a trade mission from your city to an unaffiliated city.
 * Shows cost, acceptance probability estimate, and optional utility guarantee.
 */

import { useState } from 'react';
import { getCityUtility, getMissionCost, getCityLabor } from '../models/Game';

export default function MissionPanel({ fromCity, toCity, game, onSendMission, onClose }) {
  const [guarantee, setGuarantee] = useState(0);

  if (!fromCity || !toCity) return null;

  const cost = getMissionCost(game, fromCity, toCity);
  const labor = getCityLabor(fromCity, game);
  const canAfford = labor.remaining >= cost;

  // Estimate acceptance probability
  const nearbyGains = [];
  for (const city of game.cities) {
    if (city.leagueId !== game.currentPlayer) continue;
    const dist = Math.abs(city.row - toCity.row) + Math.abs(city.col - toCity.col);
    if (dist < 15) {
      const utilGain = getCityUtility(city) - city.autarchyUtility;
      nearbyGains.push(utilGain / (1 + dist * 0.1));
    }
  }
  const avgGain = nearbyGains.length > 0
    ? nearbyGains.reduce((s, g) => s + g, 0) / nearbyGains.length
    : 0;
  const pAccept = 1 / (1 + Math.exp(-0.5 * (avgGain - 0.2)));

  const handleSend = () => {
    onSendMission(fromCity.id, toCity.id, guarantee > 0 ? toCity.autarchyUtility * (1 + guarantee / 100) : null);
    onClose();
  };

  return (
    <div className="panel mission-panel">
      <div className="panel-header">
        <h3>Trade Mission</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="mission-info">
        <p>
          Send a trade mission from <strong>{fromCity.name}</strong> to <strong>{toCity.name}</strong> to invite them to join your league.
        </p>

        <div className="mission-stats">
          <div className="stat">
            <span className="stat-label">Labor Cost</span>
            <span className="stat-value">{cost}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Available Labor</span>
            <span className="stat-value" style={{ color: canAfford ? '#3a7d44' : '#8b2500' }}>
              {labor.remaining.toFixed(1)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Est. Acceptance</span>
            <span className="stat-value">{(pAccept * 100).toFixed(0)}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Target Autarchy</span>
            <span className="stat-value">{toCity.autarchyUtility.toFixed(3)}</span>
          </div>
        </div>

        <div className="mission-guarantee">
          <label>
            Utility Guarantee: +{guarantee}% above autarchy
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={guarantee}
              onChange={(e) => setGuarantee(parseInt(e.target.value))}
            />
          </label>
          {guarantee > 0 && (
            <p className="mission-guarantee-note">
              You guarantee utility of {(toCity.autarchyUtility * (1 + guarantee / 100)).toFixed(3)}.
              If you fail to deliver, the city will likely secede!
            </p>
          )}
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSend}
        disabled={!canAfford}
      >
        {canAfford ? 'Send Mission' : 'Not Enough Labor'}
      </button>
    </div>
  );
}
