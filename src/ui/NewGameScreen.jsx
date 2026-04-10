/**
 * New Game screen: choose map, players, and start.
 */

import { useState } from 'react';

const LEAGUE_COLORS = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];

export default function NewGameScreen({ onStartGame }) {
  const [mapChoice, setMapChoice] = useState('tutorial');
  const [playerCount, setPlayerCount] = useState(1);
  const [players, setPlayers] = useState([
    { name: 'Hanseatic League', isHuman: true, color: LEAGUE_COLORS[0] },
    { name: 'Venetian League', isHuman: false, color: LEAGUE_COLORS[1] },
    { name: 'Iberian League', isHuman: false, color: LEAGUE_COLORS[2] },
    { name: 'Eastern League', isHuman: false, color: LEAGUE_COLORS[3] },
  ]);

  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    setPlayers(newPlayers);
  };

  const handleStart = () => {
    onStartGame({
      mapChoice,
      players: players.slice(0, playerCount),
    });
  };

  return (
    <div className="new-game-screen">
      <div className="new-game-content">
        <h1 className="game-title">HANSA</h1>
        <p className="game-subtitle">A Game of Comparative Advantage</p>
        <p className="game-credit">Based on the original by David D. Friedman & Tom Courtney</p>

        <div className="new-game-section">
          <h3>Choose Map</h3>
          <div className="map-choices">
            <button
              className={`map-choice ${mapChoice === 'tutorial' ? 'selected' : ''}`}
              onClick={() => setMapChoice('tutorial')}
            >
              <div className="map-choice-name">Tutorial Island</div>
              <div className="map-choice-desc">4 cities, small map. Learn the basics.</div>
            </button>
            <button
              className={`map-choice ${mapChoice === 'europe' ? 'selected' : ''}`}
              onClick={() => setMapChoice('europe')}
            >
              <div className="map-choice-name">Napoleonic Europe</div>
              <div className="map-choice-desc">18 cities across Europe. The classic experience.</div>
            </button>
            <button
              className={`map-choice ${mapChoice === 'random' ? 'selected' : ''}`}
              onClick={() => setMapChoice('random')}
            >
              <div className="map-choice-name">Random World</div>
              <div className="map-choice-desc">Procedurally generated. Different every time.</div>
            </button>
          </div>
        </div>

        <div className="new-game-section">
          <h3>Players</h3>
          <div className="player-count">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                className={`player-count-btn ${playerCount === n ? 'selected' : ''}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="player-list">
            {players.slice(0, playerCount).map((player, i) => (
              <div key={i} className="player-config" style={{ borderLeft: `4px solid ${player.color}` }}>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => handlePlayerChange(i, 'name', e.target.value)}
                  className="player-name-input"
                />
                <label className="player-human-toggle">
                  <input
                    type="checkbox"
                    checked={player.isHuman}
                    onChange={(e) => handlePlayerChange(i, 'isHuman', e.target.checked)}
                  />
                  Human
                </label>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-large" onClick={handleStart}>
          Start Game
        </button>

        <div className="new-game-help">
          <h4>How to Play</h4>
          <ul>
            <li><strong>Click a city</strong> to open its production panel and allocate labor</li>
            <li><strong>Drag between two cities</strong> in your league to set up trade routes</li>
            <li><strong>Drag from your city to an unaffiliated city</strong> to send a trade mission</li>
            <li><strong>End Turn</strong> to resolve trade missions, check for secession, and score points</li>
            <li>Your goal: build a trading league where all cities benefit from trade</li>
            <li>The key insight: <em>comparative advantage</em> means trade helps both sides, even when one city is better at everything</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
