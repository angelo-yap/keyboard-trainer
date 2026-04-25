import { useState } from "react";
import { loadState, updateState } from "../lib/storage";

const TASKS = Array.from({ length: 10 }).map((_, i) => ({
  id: i,
  title: `Task ${i + 1}`,
  desc: [
    "Home row warmup",
    "Left hand focus",
    "Right hand focus",
    "Top row intro",
    "Bottom row intro",
    "Common bigrams",
    "Common trigrams",
    "Accuracy drill",
    "Speed drill",
    "Mixed review",
  ][i],
}));

export default function Learn() {
  const [st, setSt] = useState(loadState());

  const toggle = (idx) => {
    const next = updateState((s) => {
      const learnDone = [...s.learnDone];
      learnDone[idx] = !learnDone[idx];
      return { ...s, learnDone };
    });
    setSt(next);
  };

  return (
    <div className="learnWrap">
      <div className="learnHeader">
        <div>
          <div className="learnTitle">Learn Mode</div>
          <div className="learnSub">10 guided tasks • saved locally</div>
        </div>
        <div className="pill">
          Completed: {st.learnDone.filter(Boolean).length}/10
        </div>
      </div>

      <div className="learnGrid">
        {TASKS.map((t) => {
          const done = st.learnDone[t.id];
          return (
            <button
              key={t.id}
              className={`learnCard ${done ? "done" : ""}`}
              onClick={() => toggle(t.id)}
            >
              <div className="learnCardTop">
                <div className="learnCardTitle">
                  {done ? "✅ " : "⬜️ "}
                  {t.title}
                </div>
                <div className="learnCardDesc">{t.desc}</div>
              </div>
              <div className="learnCardHint">
                Click to {done ? "unmark" : "mark complete"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}