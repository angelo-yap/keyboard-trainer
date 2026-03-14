import type { TypingStats } from "../../hooks/useTyping";
import { Button } from "./Button";
import "./ResultsCard.css";

type ResultsCardProps = {
  result: TypingStats & { duration?: number };
  title?: string;
  onRetry: () => void;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  showNext?: boolean;
};

export function ResultsCard({
  result,
  title = "Complete!",
  onRetry,
  onNext,
  onBack,
  nextLabel = "Next →",
  showNext = false,
}: ResultsCardProps) {
  const grade =
    result.accuracy >= 98 ? "S" : result.accuracy >= 95 ? "A" : result.accuracy >= 90 ? "B" : result.accuracy >= 80 ? "C" : "D";

  return (
    <div className="results-card">
      <div className="results-card-title">{title}</div>

      <div className="results-card-hero">
        <div>
          <div className="results-card-wpm">{result.wpm}</div>
          <div className="results-card-wpm-label">words per minute</div>
        </div>
        <div className={`results-card-grade results-card-grade--${grade.toLowerCase()}`}>
          {grade}
        </div>
      </div>

      <div className="results-card-stats">
        {[
          ["Accuracy", result.accuracy + "%"],
          ["Raw WPM", result.rawWpm || result.wpm],
          ["Errors", result.errors],
          ["Chars", result.chars],
          ...(result.duration ? [[ "Time", result.duration + "s" ] as const] : []),
        ].map(([label, val]) => (
          <div key={label} className="results-card-stat">
            <div className="results-card-stat-label">{label}</div>
            <div className="results-card-stat-value">{val}</div>
          </div>
        ))}
      </div>

      <div className="results-card-actions">
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
