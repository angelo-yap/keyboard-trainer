import { loadState } from "../lib/storage";

export default function Home({ onGo }) {
  const st = loadState();

  return (
    <>
      <div className="hero">
        <div>
          <div className="heroKicker">Welcome back</div>
          <div className="heroTitle">
            Train smarter. <span className="accent">Type faster.</span>
          </div>
          <div className="heroDesc">
            Learn the right fingers, practice patterns, then test your WPM—
            everything saved locally.
          </div>

          <div className="heroActions">
            <button className="btn btnAccent" onClick={() => onGo("practice")}>
              Start Practice
            </button>
            <button className="btn" onClick={() => onGo("test")}>
              Start Test
            </button>
          </div>
        </div>

        <div className="heroRight" aria-hidden="true">
          <div className="kbdMini">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="keyMini" />
            ))}
            <div className="scanMini" />
          </div>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panelTitle">Quick stats</div>
          <div className="statRow">
            <div className="stat">
              <div className="statLabel">Best WPM</div>
              <div className="statValue">{st.bestWpm}</div>
            </div>
            <div className="stat">
              <div className="statLabel">Learn tasks done</div>
              <div className="statValue">
                {st.learnDone.filter(Boolean).length}/10
              </div>
            </div>
            <div className="stat">
              <div className="statLabel">Tests</div>
              <div className="statValue">{st.testHistory.length}</div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle">Next up</div>
          <div className="list">
            <div className="listItem">➡️ Practice your weakest key</div>
            <div className="listItem">➡️ Do a 30s WPM test</div>
            <div className="listItem">➡️ Finish 10 Learn tasks</div>
          </div>
        </section>
      </div>
    </>
  );
}