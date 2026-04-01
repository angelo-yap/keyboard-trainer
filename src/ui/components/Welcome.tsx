/* ─── Welcome — first-time greeting for onboarding flow ──────────────────── */

import "./Welcome.css";

type WelcomeProps = {
  onStart: () => void;
  onSkip: () => void;
};

export function Welcome({ onStart, onSkip }: WelcomeProps) {
  return (
    <div className="welcome-root">
      <div className="welcome-card">
        <h1 className="welcome-title">Welcome</h1>
        <p className="welcome-sub">
          Learn touch typing from the ground up. A short guided course will
          introduce you to proper finger placement, home row, and the basics of
          typing without looking.
        </p>
        <p className="welcome-sub welcome-sub--muted">
          The best way to start is to go through the learning steps. You can
          always return to practice or take a speed test later.
        </p>
        <div className="welcome-actions">
          <button
            type="button"
            className="welcome-cta welcome-cta--primary"
            onClick={onStart}
          >
            Start Learning
          </button>
          <button
            type="button"
            className="welcome-cta welcome-cta--skip"
            onClick={onSkip}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
