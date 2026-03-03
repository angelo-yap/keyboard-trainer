import { useState, useEffect } from "react";
import { LEARN_STEPS } from "../core/lesson/learnSteps";
import { KeyboardVisual } from "../ui/components/KeyboardVisual";
import { Button } from "../ui/components/Button";
import "./Learn.css";

type LearnProps = {
  onBack: () => void;
};

export function Learn({ onBack }: LearnProps) {
  const [step, setStep] = useState(0);
  const current = LEARN_STEPS[step];
  const total = LEARN_STEPS.length;

  const canNext = step < total - 1;
  const canPrev = step > 0;

  return (
    <div className="learn">
      <div className="learn-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div className="learn-progress-bar">
          <div
            className="learn-progress-fill"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <span className="learn-step-label">
          {step + 1} / {total}
        </span>
      </div>

      <div className="learn-dots">
        {LEARN_STEPS.map((s, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            className={`learn-dot ${i === step ? "learn-dot-active" : ""} ${i < step ? "learn-dot-done" : ""}`}
          />
        ))}
      </div>

      <div className="learn-card">
        <div className="learn-card-icon">{current.icon}</div>
        <h3 className="learn-card-title">{current.title}</h3>
        <p className="learn-card-body">{current.body}</p>
      </div>

      {current.highlight.length > 0 && (
        <div className="learn-keyboard">
          <div className="learn-keyboard-label">Highlighted keys for this step</div>
          <HighlightKeyboard keys={current.highlight} />
        </div>
      )}

      <div className="learn-nav">
        <Button
          variant="secondary"
          onClick={() => canPrev && setStep((s) => s - 1)}
          disabled={!canPrev}
        >
          ← Previous
        </Button>

        <div className="learn-dots-inline">
          {LEARN_STEPS.map((s, i) => (
            <span
              key={i}
              className={`learn-dot-inline ${i <= step ? "active" : ""}`}
              onClick={() => setStep(i)}
            >
              ●
            </span>
          ))}
        </div>

        {canNext ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
            Next →
          </Button>
        ) : (
          <Button variant="primary" onClick={onBack}>
            Start Practicing! 🎯
          </Button>
        )}
      </div>
    </div>
  );
}

function HighlightKeyboard({ keys }: { keys: string[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (keys.length === 0) return;
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % keys.length);
    }, 700);
    return () => clearInterval(interval);
  }, [keys.length]);

  return (
    <div className="learn-highlight-keyboard">
      <KeyboardVisual
        highlightChar={keys[idx % keys.length]}
        pressedKey=""
        showFingerColors={true}
      />
    </div>
  );
}
