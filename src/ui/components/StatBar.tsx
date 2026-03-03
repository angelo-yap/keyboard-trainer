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
    { label: "WPM", value: stats.wpm || 0, color: "#ff8c32" },
    {
      label: "Accuracy",
      value: (stats.accuracy ?? 100) + "%",
      color: (stats.accuracy ?? 100) < 90 ? "#ff5555" : "#7ec87e",
    },
    {
      label: "Errors",
      value: stats.errors || 0,
      color: stats.errors > 0 ? "#ff5555" : "rgba(255,255,255,0.6)",
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
