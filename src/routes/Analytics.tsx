import { useState } from "react";
import { getTestHistory } from "../core/storage/testHistoryStore";
import { getPracticeProgress } from "../core/storage/progressStore";
import { getKeyStats } from "../core/storage/keyStatsStore";
import { getStreak } from "../core/storage/streakStore";
import { PRACTICE_LESSONS } from "../core/lesson/lessons/practiceLessons";
import { Button } from "../ui/components/Button";
import "./Analytics.css";

type AnalyticsProps = {
  onBack: () => void;
};

const panel = {
  padding: "16px 20px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
};

export function Analytics({ onBack }: AnalyticsProps) {
  const [tab, setTab] = useState<"overview" | "history" | "keys" | "practice">("overview");
  const history = getTestHistory();
  const progress = getPracticeProgress();
  const keyStats = getKeyStats();
  const streak = getStreak();

  const bestWpm = history.length ? Math.max(...history.map((h) => h.wpm)) : 0;
  const avgWpm = history.length
    ? Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length)
    : 0;
  const avgAcc = history.length
    ? Math.round(history.reduce((a, b) => a + b.accuracy, 0) / history.length)
    : 0;

  const chartData = history.slice(0, 20).reverse();
  const maxWpm = chartData.length ? Math.max(...chartData.map((h) => h.wpm), 10) : 100;

  const keyList = Object.entries(keyStats)
    .map(([k, v]) => ({
      key: k,
      accuracy: Math.round(((v.attempts - v.errors) / v.attempts) * 100),
      attempts: v.attempts,
      errors: v.errors,
    }))
    .filter((k) => k.attempts >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);

  const worstKeys = keyList.slice(0, 8);
  const bestKeys = keyList.slice(-8).reverse();

  return (
    <div className="analytics">
      <div className="analytics-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div className="analytics-title">Analytics</div>
      </div>

      <div className="analytics-stats">
        {[
          ["Best WPM", bestWpm || "—", "#ff8c32"],
          ["Avg WPM", avgWpm || "—", "rgba(255,255,255,0.85)"],
          ["Avg Accuracy", avgAcc ? avgAcc + "%" : "—", avgAcc >= 95 ? "#7ec87e" : "rgba(255,255,255,0.85)"],
          ["Sessions", history.length, "rgba(255,255,255,0.7)"],
          ["🔥 Streak", streak.count + " days", "#ff8c32"],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="analytics-stat-card">
            <div className="analytics-stat-label">{label}</div>
            <div className="analytics-stat-value" style={{ color: color as string }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-tabs">
        {(["overview", "history", "keys", "practice"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`analytics-tab ${tab === t ? "active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="analytics-tab-content">
          {chartData.length >= 2 ? (
            <div className="analytics-panel" style={panel}>
              <div className="analytics-panel-title">
                WPM Progress (last {chartData.length} tests)
              </div>
              <WpmChart data={chartData} maxWpm={maxWpm} />
            </div>
          ) : (
            <Empty msg="Complete at least 2 tests to see your progress chart" />
          )}

          {worstKeys.length > 0 && (
            <div className="analytics-panel" style={panel}>
              <div className="analytics-panel-title">Keys to improve</div>
              <KeyGrid keys={worstKeys} color="#ff5555" />
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="analytics-panel" style={panel}>
          <div className="analytics-panel-title">
            All test sessions ({history.length})
          </div>
          {history.length === 0 ? (
            <Empty msg="No tests yet" />
          ) : (
            <div className="analytics-history-list">
              {history.map((h, i) => (
                <div key={i} className="analytics-history-item">
                  <span className="analytics-history-wpm">{h.wpm} WPM</span>
                  <span
                    className="analytics-history-acc"
                    style={{
                      color:
                        h.accuracy >= 95
                          ? "#7ec87e"
                          : h.accuracy >= 85
                            ? "#e09a54"
                            : "#ff5555",
                    }}
                  >
                    {h.accuracy}% acc
                  </span>
                  {h.errors !== undefined && (
                    <span className="analytics-history-err">{h.errors} err</span>
                  )}
                  {h.duration && (
                    <span className="analytics-history-dur">{h.duration}s</span>
                  )}
                  <span className="analytics-history-date">
                    {new Date(h.date).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "keys" && (
        <div className="analytics-keys-grid">
          <div className="analytics-panel" style={panel}>
            <div className="analytics-panel-title">Weakest keys</div>
            {worstKeys.length ? (
              <KeyGrid keys={worstKeys} color="#ff5555" />
            ) : (
              <Empty msg="Not enough data yet" />
            )}
          </div>
          <div className="analytics-panel" style={panel}>
            <div className="analytics-panel-title">Strongest keys</div>
            {bestKeys.length ? (
              <KeyGrid keys={bestKeys} color="#7ec87e" />
            ) : (
              <Empty msg="Not enough data yet" />
            )}
          </div>
        </div>
      )}

      {tab === "practice" && (
        <div className="analytics-panel" style={panel}>
          <div className="analytics-panel-title">Lesson progress</div>
          <div className="analytics-practice-list">
            {PRACTICE_LESSONS.map((lesson) => {
              const done = progress.completed.includes(lesson.id);
              const attempts = progress.attempts[lesson.id] || [];
              const bestAcc = attempts.length
                ? Math.max(...attempts.map((a) => a.accuracy))
                : null;
              const bestWpm = attempts.length
                ? Math.max(...attempts.map((a) => a.wpm))
                : null;
              return (
                <div
                  key={lesson.id}
                  className={`analytics-practice-item ${done ? "done" : ""}`}
                >
                  <span className="analytics-practice-icon">
                    {done ? "✅" : attempts.length ? "🔄" : "⬜"}
                  </span>
                  <span className="analytics-practice-name">{lesson.name}</span>
                  {bestAcc !== null && (
                    <>
                      <span
                        className="analytics-practice-acc"
                        style={{
                          color: bestAcc >= 90 ? "#7ec87e" : "#e09a54",
                        }}
                      >
                        {bestAcc}% acc
                      </span>
                      <span className="analytics-practice-wpm">{bestWpm} WPM</span>
                    </>
                  )}
                  {attempts.length > 0 && (
                    <span className="analytics-practice-tries">
                      {attempts.length} tries
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WpmChart({
  data,
  maxWpm,
}: {
  data: { wpm: number; accuracy: number; date: string }[];
  maxWpm: number;
}) {
  const H = 120;
  const W_unit = Math.max(24, Math.min(48, 700 / data.length));

  return (
    <div className="wpm-chart">
      <div
        className="wpm-chart-bars"
        style={{
          height: H + 30,
          minWidth: data.length * (W_unit + 4),
        }}
      >
        {data.map((d, i) => {
          const h = Math.max(4, (d.wpm / maxWpm) * H);
          const isRecent = i === data.length - 1;
          return (
            <div key={i} className="wpm-chart-bar">
              <div
                className={`wpm-chart-value ${isRecent ? "recent" : ""}`}
              >
                {d.wpm}
              </div>
              <div
                className="wpm-chart-rect"
                style={{
                  width: W_unit,
                  height: h,
                  background: isRecent
                    ? "#ff8c32"
                    : d.accuracy >= 95
                      ? "rgba(126,200,126,0.7)"
                      : "rgba(255,140,50,0.45)",
                }}
                title={`${d.wpm} WPM, ${d.accuracy}% acc`}
              />
              <div className="wpm-chart-date">
                {new Date(d.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyGrid({
  keys,
  color,
}: {
  keys: { key: string; accuracy: number; attempts: number }[];
  color: string;
}) {
  return (
    <div className="key-grid">
      {keys.map(({ key, accuracy, attempts }) => (
        <div
          key={key}
          className="key-grid-item"
          style={{ borderColor: `${color}40` }}
          title={`${attempts} attempts`}
        >
          <div className="key-grid-key">{key.toUpperCase()}</div>
          <div className="key-grid-acc" style={{ color }}>
            {accuracy}%
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="analytics-empty">{msg}</div>
  );
}
