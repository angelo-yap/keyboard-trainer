import type { TypingStats } from "../../hooks/useTyping";

type StatItem = {
  label: string;
  value: string | number;
  color: string;
};

type StatBarProps = {
  stats: TypingStats;
  extra?: StatItem[];
};

export function StatBar({ stats, extra = [] }: StatBarProps) {
  const items: StatItem[] = [
    { label: "WPM", value: stats.wpm || 0, color: "var(--color-accent)" },
    {
      label: "Accuracy",
      value: (stats.accuracy ?? 100) + "%",
      color: (stats.accuracy ?? 100) < 90 ? "var(--color-error)" : "var(--color-correct)",
    },
    {
      label: "Errors",
      value: stats.errors || 0,
      color: stats.errors > 0 ? "var(--color-error)" : "var(--color-text-3)",
    },
    ...extra,
  ];

  return (
    <div className="stat-bar">
      {items.map(({ label, value, color }) => (
        <div key={label} className="stat-bar-item">
          <span className="stat-bar-label">{label}</span>
          <span className="stat-bar-value" style={{ color }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
