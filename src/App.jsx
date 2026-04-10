/**
 * Main App component for Hansa.
 * Manages game state and routes between New Game screen and main game view.
 */

import { useState, useCallback } from 'react';
import { createGame, recalcTradeFlows, endTurn, serializeGame, deserializeGame } from './models/Game';
import { GOODS } from './utils/economics';
import { runAI } from './ai/ComputerPlayer';
import { tutorialMap } from './maps/tutorial';
import { europeMap } from './maps/europe';
import { generateRandomMap } from './maps/random';
import MapView from './ui/MapView';
import ProductionPanel from './ui/ProductionPanel';
import TradePanel from './ui/TradePanel';
import MissionPanel from './ui/MissionPanel';
import ScorePanel from './ui/ScorePanel';
import LogPanel from './ui/LogPanel';
import NewGameScreen from './ui/NewGameScreen';
import './App.css';

function App() {
  const [game, setGame] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [tradePanel, setTradePanel] = useState(null);
  const [missionPanel, setMissionPanel] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [turnMessages, setTurnMessages] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleStartGame = useCallback((config) => {
    let mapData;
    switch (config.mapChoice) {
      case 'tutorial': mapData = tutorialMap; break;
      case 'europe': mapData = europeMap; break;
      case 'random': mapData = generateRandomMap(); break;
      default: mapData = tutorialMap;
    }

    const newGame = createGame(mapData, config.players);
    setGame(newGame);
    setSelectedCity(null);
    setTradePanel(null);
    setMissionPanel(null);
    setTurnMessages(null);
  }, []);

  const updateGame = useCallback((updater) => {
    setGame(prev => {
      const next = { ...prev };
      updater(next);
      return next;
    });
  }, []);

  const handleCityClick = useCallback((city) => {
    setSelectedCity(city.id);
    setTradePanel(null);
    setMissionPanel(null);
  }, []);

  const handleCityDrag = useCallback((fromCity, toCity) => {
    if (!game) return;
    if (fromCity.leagueId === game.currentPlayer && toCity.leagueId === game.currentPlayer) {
      setTradePanel({ cityAId: fromCity.id, cityBId: toCity.id });
      setSelectedCity(null);
      setMissionPanel(null);
    } else if (fromCity.leagueId === game.currentPlayer && toCity.leagueId === null) {
      // Don't open panel if mission already pending to this city
      const alreadyPending = game.missions.some(
        m => m.toCityId === toCity.id && m.leagueId === game.currentPlayer
      );
      if (alreadyPending) return;
      setMissionPanel({ fromCityId: fromCity.id, toCityId: toCity.id });
      setSelectedCity(null);
      setTradePanel(null);
    }
  }, [game]);

  const handleProductionChange = useCallback((cityId, newProduction) => {
    updateGame(g => {
      g.cities[cityId].production = { ...newProduction };
      recalcTradeFlows(g);
    });
  }, [updateGame]);

  const handleTradeChange = useCallback((cityAId, cityBId, goods) => {
    updateGame(g => {
      let trade = g.trades.find(
        t => (t.fromCityId === cityAId && t.toCityId === cityBId) ||
             (t.fromCityId === cityBId && t.toCityId === cityAId)
      );
      if (!trade) {
        trade = { fromCityId: cityAId, toCityId: cityBId, goods: {} };
        g.trades.push(trade);
      }
      if (trade.fromCityId === cityAId) {
        trade.goods = { ...goods };
      } else {
        trade.goods = {};
        for (const good of GOODS) {
          trade.goods[good] = -(goods[good] || 0);
        }
      }
      recalcTradeFlows(g);
    });
  }, [updateGame]);

  const handleRemoveTrade = useCallback((cityAId, cityBId) => {
    updateGame(g => {
      g.trades = g.trades.filter(
        t => !((t.fromCityId === cityAId && t.toCityId === cityBId) ||
               (t.fromCityId === cityBId && t.toCityId === cityAId))
      );
      recalcTradeFlows(g);
    });
    setTradePanel(null);
  }, [updateGame]);

  const handleSendMission = useCallback((fromCityId, toCityId, guaranteedUtility) => {
    updateGame(g => {
      // Prevent duplicate missions to the same target city
      const alreadyPending = g.missions.some(
        m => m.toCityId === toCityId && m.leagueId === g.currentPlayer
      );
      if (alreadyPending) return;

      g.missions.push({
        leagueId: g.currentPlayer,
        fromCityId,
        toCityId,
        guaranteedUtility,
      });
    });
  }, [updateGame]);

  const handleEndTurn = useCallback(() => {
    // Work on the current game state directly (via ref-like access)
    // to avoid StrictMode double-invoke duplicating messages
    const g = { ...game, cities: game.cities.map(c => ({ ...c, production: { ...c.production }, imports: { ...c.imports }, exports: { ...c.exports } })), leagues: game.leagues.map(l => ({ ...l })), trades: game.trades.map(t => ({ ...t, goods: { ...t.goods } })), missions: [...game.missions], log: [...game.log] };

    const allMessages = [];
    const humanMessages = endTurn(g);
    allMessages.push(...humanMessages);

    while (!g.gameOver && !g.leagues[g.currentPlayer].isHuman) {
      const aiLog = runAI(g, g.currentPlayer);
      allMessages.push(...aiLog);
      const turnMsgs = endTurn(g);
      allMessages.push(...turnMsgs);
    }

    setGame(g);
    setTurnMessages(allMessages.length > 0 ? allMessages : null);
    setSelectedCity(null);
    setTradePanel(null);
    setMissionPanel(null);
    if (allMessages.length > 0) {
      setTimeout(() => setTurnMessages(null), 10000);
    }
  }, [game]);

  const handleSave = useCallback(() => {
    if (!game) return;
    const json = serializeGame(game);
    localStorage.setItem('hansa_save', json);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hansa_save_turn${game.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [game]);

  const handleLoad = useCallback(() => {
    const saved = localStorage.getItem('hansa_save');
    if (saved) {
      try {
        setGame(deserializeGame(saved));
        setSelectedCity(null);
        setTradePanel(null);
        setMissionPanel(null);
        return;
      } catch (e) { /* fall through */ }
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          setGame(deserializeGame(ev.target.result));
          setSelectedCity(null);
          setTradePanel(null);
          setMissionPanel(null);
        } catch (err) {
          alert('Failed to load save file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  if (!game) {
    return <NewGameScreen onStartGame={handleStartGame} />;
  }

  const currentTrade = tradePanel
    ? game.trades.find(
        t => (t.fromCityId === tradePanel.cityAId && t.toCityId === tradePanel.cityBId) ||
             (t.fromCityId === tradePanel.cityBId && t.toCityId === tradePanel.cityAId)
      )
    : null;

  return (
    <div className="game-container">
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="game-title-small">HANSA</span>
          <button className="btn btn-small" onClick={() => setGame(null)}>New Game</button>
          <button className="btn btn-small" onClick={handleSave}>Save</button>
          <button className="btn btn-small" onClick={handleLoad}>Load</button>
          <button className="btn btn-small" onClick={() => setShowHelp(!showHelp)}>Help</button>
          <button className="btn btn-small" onClick={() => setShowLog(!showLog)}>Log</button>
        </div>
        <div className="top-bar-right">
          <ScorePanel game={game} />
        </div>
      </div>

      <div className="main-content">
        <div className="map-container">
          <MapView
            game={game}
            selectedCityId={selectedCity}
            onCityClick={handleCityClick}
            onCityDrag={handleCityDrag}
          />
        </div>

        <div className="side-panel">
          {selectedCity !== null && (
            <ProductionPanel
              city={game.cities[selectedCity]}
              game={game}
              onProductionChange={handleProductionChange}
              onClose={() => setSelectedCity(null)}
            />
          )}

          {tradePanel && (
            <TradePanel
              cityA={game.cities[tradePanel.cityAId]}
              cityB={game.cities[tradePanel.cityBId]}
              trade={currentTrade}
              game={game}
              onTradeChange={handleTradeChange}
              onClose={() => setTradePanel(null)}
              onRemoveTrade={handleRemoveTrade}
            />
          )}

          {missionPanel && (
            <MissionPanel
              fromCity={game.cities[missionPanel.fromCityId]}
              toCity={game.cities[missionPanel.toCityId]}
              game={game}
              onSendMission={handleSendMission}
              onClose={() => setMissionPanel(null)}
            />
          )}

          {!selectedCity && !tradePanel && !missionPanel && (
            <div className="panel hint-panel">
              <h3>Quick Guide</h3>
              <p><strong>Click</strong> a city to manage production</p>
              <p><strong>Drag</strong> between league cities to trade</p>
              <p><strong>Drag</strong> from your city to a neutral city to send a trade mission</p>
              <p>Pending missions: {game.missions.filter(m => m.leagueId === game.currentPlayer).length}</p>
              <hr />
              <p className="hint-tip">
                Tip: Trade is beneficial even when one city produces everything more cheaply.
                What matters is <em>comparative advantage</em> — relative costs, not absolute costs.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bottom-bar">
        <button className="btn btn-primary btn-end-turn" onClick={handleEndTurn} disabled={game.gameOver}>
          {game.gameOver ? 'Game Over!' : 'End Turn'}
        </button>
        {game.missions.filter(m => m.leagueId === game.currentPlayer).length > 0 && (
          <span className="pending-missions">
            {game.missions.filter(m => m.leagueId === game.currentPlayer).length} mission(s) pending
          </span>
        )}
      </div>

      {turnMessages && turnMessages.length > 0 && (
        <div className="turn-messages" onClick={() => setTurnMessages(null)}>
          <div className="turn-messages-content">
            <h3>Turn Results</h3>
            {turnMessages.map((msg, i) => (
              <div key={i} className="turn-message">{msg}</div>
            ))}
            <p className="turn-messages-dismiss">Click to dismiss</p>
          </div>
        </div>
      )}

      {showLog && (
        <div className="overlay" onClick={() => setShowLog(false)}>
          <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
            <LogPanel game={game} />
            <button className="btn btn-small" onClick={() => setShowLog(false)}>Close</button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="overlay" onClick={() => setShowHelp(false)}>
          <div className="overlay-content help-content" onClick={(e) => e.stopPropagation()}>
            <h2>How to Play Hansa</h2>
            <h3>Overview</h3>
            <p>
              Hansa is a turn-based strategy game where you build a trading league. Cities join your league
              voluntarily when they see that trade makes them better off. Your goal is to maximize the total
              utility gain above autarchy (self-sufficiency) across all your cities.
            </p>
            <h3>Production</h3>
            <p>
              Each city has a labor pool. Use sliders to allocate labor among goods (wheat, fish, iron, silk).
              Each good has a different labor cost per unit, determined by the city's surrounding terrain.
              Coastal cities produce fish cheaply; mountain cities produce iron cheaply.
            </p>
            <h3>Trade</h3>
            <p>
              Drag between two league cities to open a trade window. Adjust how much of each good flows
              between them. Transport costs consume labor from the exporting city — water routes are much
              cheaper than land routes.
            </p>
            <h3>Comparative Advantage</h3>
            <p>
              The key economic insight: it pays to specialize in what you're <em>relatively</em> best at,
              even if another city is absolutely better at everything. A city that produces wheat at cost 2
              and iron at cost 4 should trade wheat for iron with a city that produces wheat at cost 6 and
              iron at cost 3 — both benefit!
            </p>
            <h3>League Expansion</h3>
            <p>
              Drag from your city to an unaffiliated city to send a trade mission. Cities are more likely
              to join if nearby league cities are visibly prospering (high utility gain). You can offer a
              utility guarantee, but beware — if you can't deliver, the city will secede!
            </p>
            <h3>Scoring</h3>
            <p>
              Each turn, you score the total utility gain above autarchy for all your cities. Build the
              most prosperous league to win!
            </p>
            <button className="btn btn-primary" onClick={() => setShowHelp(false)}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
