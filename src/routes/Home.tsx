import { getTestHistory } from "../core/storage/testHistoryStore";
import { getPracticeProgress } from "../core/storage/progressStore";
import { getStreak } from "../core/storage/streakStore";
import { PRACTICE_LESSONS } from "../core/lesson/lessons/practiceLessons";
import "./Home.css";

type HomeProps = {
  setTab: (tab: string) => void;
};

export function Home({ setTab }: HomeProps) {
  const history = getTestHistory();
  const progress = getPracticeProgress();
  const streak = getStreak();

  const bestWpm = history.length ? Math.max(...history.map((h) => h.wpm)) : null;
  const avgWpm =
    history.length
      ? Math.round(
          history.slice(0, 10).reduce((a, b) => a + b.wpm, 0) /
            Math.min(10, history.length)
        )
      : null;
  const completedLessons = progress.completed.length;
  const totalLessons = PRACTICE_LESSONS.length;

  const recentTests = history.slice(0, 5);

  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-hero-text">
          <div className="home-hero-badge">
            {streak.count > 0 ? `🔥 ${streak.count} day streak` : "Welcome"}
          </div>
          <h2 className="home-hero-title">
            Train smarter.
            <br />
            <span className="home-hero-accent">Type faster.</span>
          </h2>
          <p className="home-hero-desc">
            Guided lessons, keybr-style practice with finger highlighting, and
            Monkeytype-style WPM tests — everything saved locally.
          </p>
        </div>

        <div className="home-hero-stats">
          {[
            ["Best WPM", bestWpm ?? "—", "#ff8c32"],
            ["Avg WPM (10)", avgWpm ?? "—", "rgba(255,255,255,0.8)"],
            ["Lessons", `${completedLessons} / ${totalLessons}`, "#7ec8a8"],
            ["Sessions", history.length, "rgba(255,255,255,0.6)"],
          ].map(([label, val, color]) => (
            <div key={String(label)} className="home-stat-row">
              <span className="home-stat-label">{label}</span>
              <span className="home-stat-value" style={{ color: color as string }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="home-modes">
        {[
          {
            tab: "learn",
            icon: "📘",
            title: "Learn",
            subtitle: "Start here",
            desc: "10-step guided intro to touch typing. Proper finger placement, posture, technique.",
            accent: "rgba(120,170,255,0.15)",
            accentBorder: "rgba(120,170,255,0.3)",
            cta: "Start Learning",
          },
          {
            tab: "practice",
            icon: "🎯",
            title: "Practice",
            subtitle: `${completedLessons}/${totalLessons} complete`,
            desc: "12 progressive keybr-style lessons. Live finger highlighting. Unlock as you improve.",
            accent: "rgba(255,140,50,0.12)",
            accentBorder: "rgba(255,140,50,0.25)",
            cta: "Practice Now",
            primary: true,
          },
          {
            tab: "test",
            icon: "⌨️",
            title: "WPM Test",
            subtitle: bestWpm ? `Best: ${bestWpm} WPM` : "Untested",
            desc: "Race against time. Random words from the top 500. Track speed and accuracy.",
            accent: "rgba(100,255,150,0.08)",
            accentBorder: "rgba(100,255,150,0.2)",
            cta: "Start Test",
          },
        ].map(({ tab, icon, title, subtitle, desc, accent, accentBorder, cta, primary }) => (
          <div
            key={tab}
            onClick={() => setTab(tab)}
            className="home-mode-card"
            style={{
              background: accent,
              borderColor: accentBorder,
            }}
          >
            <div className="home-mode-icon">{icon}</div>
            <div className="home-mode-title">{title}</div>
            <div className="home-mode-subtitle">{subtitle}</div>
            <div className="home-mode-desc">{desc}</div>
            <button
              className={`home-mode-cta ${primary ? "home-mode-cta-primary" : ""}`}
            >
              {cta} →
            </button>
          </div>
        ))}
      </div>

      {recentTests.length > 0 ? (
        <div className="home-recent">
          <div className="home-recent-title">Recent Tests</div>
          <div className="home-recent-list">
            {recentTests.map((h, i) => (
              <div key={i} className="home-recent-item">
                <span className="home-recent-wpm">{h.wpm} WPM</span>
                <span
                  className="home-recent-acc"
                  style={{
                    color: h.accuracy >= 95 ? "#7ec87e" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {h.accuracy}% acc
                </span>
                {h.duration && (
                  <span className="home-recent-dur">{h.duration}s</span>
                )}
                <span className="home-recent-date">
                  {new Date(h.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="home-empty">
          No sessions yet — pick a mode above to get started
        </div>
      )}
    </div>
  );
}
