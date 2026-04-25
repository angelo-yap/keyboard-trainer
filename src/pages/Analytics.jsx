import { loadState } from "../lib/storage";

export default function Analytics() {
  const st = loadState();
  const history = st.testHistory ?? [];

  return (
    <div className="panel">
      <div className="panelTitle">Analytics (local)</div>

      <div className="statRow" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="statLabel">Best WPM</div>
          <div className="statValue">{st.bestWpm}</div>
        </div>
        <div className="stat">
          <div className="statLabel">Streak</div>
          <div className="statValue">{st.streak}</div>
        </div>
        <div className="stat">
          <div className="statLabel">Tests saved</div>
          <div className="statValue">{history.length}</div>
        </div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Secs</th>
              <th>WPM</th>
              <th>Acc</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="mutedCell">
                  No tests yet — run a Test to see analytics.
                </td>
              </tr>
            ) : (
              history.slice(0, 15).map((h) => (
                <tr key={h.ts}>
                  <td>{new Date(h.ts).toLocaleString()}</td>
                  <td>{h.secs}</td>
                  <td>{h.wpm}</td>
                  <td>{h.acc}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}