/**
 * Turn log panel: shows what happened each turn.
 */

export default function LogPanel({ game }) {
  const { log } = game;

  if (log.length === 0) return null;

  return (
    <div className="log-panel">
      <h4>Turn Log</h4>
      <div className="log-entries">
        {[...log].reverse().map((entry, i) => (
          <div key={i} className="log-entry">
            <div className="log-entry-header">
              Turn {entry.turn} — {entry.player}
            </div>
            {entry.messages.map((msg, j) => (
              <div key={j} className="log-message">{msg}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
