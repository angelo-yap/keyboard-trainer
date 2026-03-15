import type {
  SessionState,
  SessionMetrics,
  LetterStatsEntry,
} from "../../core/session/sessionTypes";
import { Button } from "./Button";
import "./SessionAnalytics.css";

type SessionAnalyticsProps = {
  session: SessionState;
  metrics: SessionMetrics;
  title?: string;
  onRetry: () => void;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  showNext?: boolean;
};

function getGrade(accuracy: number): string {
  if (accuracy >= 98) return "S";
  if (accuracy >= 95) return "A";
  if (accuracy >= 90) return "B";
  if (accuracy >= 80) return "C";
  return "D";
}


/** Sort letters by difficulty: highest mistake rate, then most mistakes */
function getDifficultLetters(letterStats: Record<string, LetterStatsEntry>, limit = 8): [string, LetterStatsEntry][] {
  return Object.entries(letterStats)
    .filter(([, s]) => s.attempts >= 2)
    .map(([char, s]) => [char, s] as const)
    .sort(([, a], [, b]) => {
      const rateA = a.attempts > 0 ? a.mistakes / a.attempts : 0;
      const rateB = b.attempts > 0 ? b.mistakes / b.attempts : 0;
      if (rateB !== rateA) return rateB - rateA;
      return b.mistakes - a.mistakes;
    })
    .slice(0, limit);
}

function WpmGraph({ samples }: { samples: { time: number; wpm: number }[] }) {
  if (samples.length < 2) return null;

  const maxWpm = Math.max(...samples.map((s) => s.wpm), 1);
  const maxTime = Math.max(...samples.map((s) => s.time), 1);
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const width = 320;
  const height = 120;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = samples
    .map((s, i) => {
      const x = padding.left + (s.time / maxTime) * innerW;
      const y = padding.top + innerH - (s.wpm / maxWpm) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="session-analytics-graph-wrap">
      <div className="session-analytics-graph-label">WPM over time</div>
      <svg
        className="session-analytics-graph"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

export function SessionAnalytics({
  session,
  metrics,
  title = "Complete!",
  onRetry,
  onNext,
  onBack,
  nextLabel = "Next →",
  showNext = false,
}: SessionAnalyticsProps) {
  const grade = getGrade(metrics.accuracy);
  const difficultLetters = getDifficultLetters(session.letterStats);

  return (
    <div className="session-analytics">
      <div className="session-analytics-title">{title}</div>

      <div className="session-analytics-hero">
        <div>
          <div className="session-analytics-wpm">{metrics.wpm}</div>
          <div className="session-analytics-wpm-label">words per minute</div>
        </div>
        <div className={`session-analytics-grade session-analytics-grade--${grade.toLowerCase()}`}>
          {grade}
        </div>
      </div>

      <div className="session-analytics-stats">
        {[
          ["Accuracy", metrics.accuracy + "%"],
          ["Raw WPM", metrics.rawWpm || metrics.wpm],
          ["Errors", metrics.errors],
          ["Chars", metrics.chars],
          ["Time", Math.round(metrics.elapsedSeconds) + "s"],
        ].map(([label, val]) => (
          <div key={label} className="session-analytics-stat">
            <div className="session-analytics-stat-label">{label}</div>
            <div className="session-analytics-stat-value">{val}</div>
          </div>
        ))}
      </div>

      <WpmGraph samples={session.wpmSamples} />

      {difficultLetters.length > 0 && (
        <div className="session-analytics-section">
          <div className="session-analytics-section-label">Difficult letters</div>
          <div className="session-analytics-letters">
            {difficultLetters.map(([char, s]) => {
              const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 100;
              return (
                <div key={char} className="session-analytics-letter-row">
                  <span className="session-analytics-letter-key">{char}</span>
                  <div className="session-analytics-letter-bar">
                    <div
                      className={`session-analytics-letter-fill${acc < 80 ? " session-analytics-letter-fill--weak" : ""}`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>
                  <span className="session-analytics-letter-pct">{acc}%</span>
                  <span className="session-analytics-letter-mistakes">{s.mistakes} err</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {metrics.errors > 0 && (
        <div className="session-analytics-section">
          <div className="session-analytics-section-label">Mistake summary</div>
          <div className="session-analytics-mistakes">
            {metrics.errors} mistake{metrics.errors !== 1 ? "s" : ""} in {metrics.chars} characters
            ({metrics.accuracy}% accuracy)
          </div>
        </div>
      )}

      <div className="session-analytics-actions">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
        )}
        <Button variant="secondary" onClick={onRetry}>
          ↺ Retry
        </Button>
        {showNext && onNext && (
          <Button variant="primary" onClick={onNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
