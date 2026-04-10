/**
 * Score Panel: shows current scores, turn info, league summary.
 */

import { getCityUtility } from '../models/Game';

const LEAGUE_COLORS = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];

export default function ScorePanel({ game }) {
  const { leagues, cities, turn, currentPlayer } = game;

  return (
    <div className="score-panel">
      <div className="score-header">
        <span>Turn {turn}</span>
        <span className="current-player" style={{ color: leagues[currentPlayer]?.color || LEAGUE_COLORS[currentPlayer] }}>
          {leagues[currentPlayer]?.name}'s Turn
        </span>
      </div>

      <div className="score-leagues">
        {leagues.map((league, i) => {
          const leagueCities = cities.filter(c => c.leagueId === i);
          const totalUtilGain = leagueCities.reduce((sum, city) => {
            return sum + Math.max(0, getCityUtility(city) - city.autarchyUtility);
          }, 0);

          return (
            <div
              key={i}
              className={`score-league ${i === currentPlayer ? 'active' : ''}`}
              style={{ borderColor: league.color || LEAGUE_COLORS[i] }}
            >
              <div className="score-league-name" style={{ color: league.color || LEAGUE_COLORS[i] }}>
                {league.name}
                {!league.isHuman && ' (AI)'}
              </div>
              <div className="score-league-stats">
                <span>Cities: {leagueCities.length}</span>
                <span>Score: {league.score.toFixed(1)}</span>
                <span>Util Gain: +{totalUtilGain.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unaffiliated cities count */}
      <div className="score-unaffiliated">
        Unaffiliated cities: {cities.filter(c => c.leagueId === null).length} / {cities.length}
      </div>
    </div>
  );
}
