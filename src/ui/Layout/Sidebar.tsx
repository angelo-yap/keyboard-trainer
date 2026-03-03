import { getTestHistory } from "../../core/storage/testHistoryStore";
import { getPracticeProgress } from "../../core/storage/progressStore";
import { getStreak } from "../../core/storage/streakStore";
import { PRACTICE_LESSONS } from "../../core/lesson/lessons/practiceLessons";
import "./Sidebar.css";

const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "learn", label: "Learn", icon: "📘" },
  { id: "practice", label: "Practice", icon: "🎯" },
  { id: "test", label: "WPM Test", icon: "⌨️" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

type SidebarProps = {
  tab: string;
  setTab: (tab: string) => void;
};

export function Sidebar({ tab, setTab }: SidebarProps) {
  const history = getTestHistory();
  const progress = getPracticeProgress();
  const streak = getStreak();
  const bestWpm = history.length ? Math.max(...history.map((h) => h.wpm)) : null;
  const completedLessons = progress.completed.length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" />
        <div>
          <div className="sidebar-brand-name">
            Keyboard<span className="sidebar-brand-accent">Trainer</span>
          </div>
          <div className="sidebar-brand-tagline">Local · No login</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`sidebar-tab ${tab === t.id ? "sidebar-tab-active" : ""}`}
          >
            <span className="sidebar-tab-icon">{t.icon}</span>
            {t.label}
            {t.id === "practice" && completedLessons > 0 && (
              <span className="sidebar-badge">
                {completedLessons}/{PRACTICE_LESSONS.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {streak.count > 0 && (
          <div className="sidebar-streak">🔥 {streak.count} day streak</div>
        )}
        {bestWpm && (
          <div className="sidebar-best">
            <span>Best WPM</span>
            <span className="sidebar-best-value">{bestWpm}</span>
          </div>
        )}
        <div className="sidebar-version">v1.0 · All data local</div>
      </div>
    </aside>
  );
}
