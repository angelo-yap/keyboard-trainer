import { useState, useEffect, useRef, useCallback } from "react";
import { useTypingSession } from "../hooks/useTypingSession";
import { getSessionMetrics } from "../core/session/sessionTracker";
import { generateTestText } from "../core/test/testTextGenerator";
import { saveTestResult } from "../core/storage/testHistoryStore";
import { updateStreak } from "../core/storage/streakStore";
import { Keyboard } from "../ui/components/keyboard";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { SessionReportCard } from "../ui/components/SessionReport";
import { Button } from "../ui/components/Button";
import type { Settings } from "../core/storage/settingsStore";
import "../ui/Layout/LessonStage.css";
import "./Test.css";

type TestStatus = "setup" | "active" | "finished";

type TestProps = {
  onBack: () => void;
  settings: Settings;
};

const DURATION_OPTIONS = [15, 30, 60, 120] as const;
const TRANSITION_MS = 180;

export function Test({ onBack, settings }: TestProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>("setup");
  const [duration, setDuration] = useState(settings?.testDuration || 60);
  const [includePunctuation, setIncludePunctuation] = useState(false);
  const [includeNumbers, setIncludeNumbers] = useState(false);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [timerStarted, setTimerStarted] = useState(false);
  const [textTransitioning, setTextTransitioning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const endSessionRef = useRef<() => import("../core/session/sessionTypes").SessionState | null>(null);
  const hasEndedRef = useRef(false);
  const prevSettingsRef = useRef({ duration, includePunctuation, includeNumbers });
  const typingRef = useRef<{ reset: () => void } | null>(null);

  const typing = useTypingSession({
    text,
    enabled: testStatus === "active",
    sessionType: "test",
    onComplete: (_, session) => {
      if (hasEndedRef.current) return;
      hasEndedRef.current = true;
      clearInterval(timerRef.current);
      const metrics = getSessionMetrics(session);
      saveTestResult({
        wpm: metrics.wpm,
        rawWpm: metrics.rawWpm,
        accuracy: metrics.accuracy,
        errors: metrics.errors,
        chars: metrics.chars,
        duration,
        date: new Date().toISOString(),
      });
      updateStreak();
      setTestStatus("finished");
    },
  });

  endSessionRef.current = typing.endSessionEarly;
  typingRef.current = typing;

  /* Centralized: generate new test from current settings and reset session */
  const generateAndLoadTest = useCallback(() => {
    const newText = generateTestText({
      durationSeconds: duration,
      includePunctuation,
      includeNumbers,
    });
    setText(newText);
    setTimeLeft(duration);
    setTimerStarted(false);
    typingRef.current?.reset();
  }, [duration, includePunctuation, includeNumbers]);

  /* Regenerate during active test — used by settings change and manual new test */
  const regenerateTest = useCallback(() => {
    if (testStatus !== "active") return undefined;

    setTextTransitioning(true);
    clearInterval(timerRef.current);

    const timeout = setTimeout(() => {
      generateAndLoadTest();
      setTextTransitioning(false);
    }, TRANSITION_MS);

    return () => clearTimeout(timeout);
  }, [testStatus, generateAndLoadTest]);

  /* Auto-regenerate when settings change during active test */
  useEffect(() => {
    if (testStatus !== "active" || !text) return;
    const prev = prevSettingsRef.current;
    const changed =
      prev.duration !== duration ||
      prev.includePunctuation !== includePunctuation ||
      prev.includeNumbers !== includeNumbers;
    prevSettingsRef.current = { duration, includePunctuation, includeNumbers };
    if (changed) {
      const cleanup = regenerateTest();
      return cleanup;
    }
  }, [testStatus, text, duration, includePunctuation, includeNumbers, regenerateTest]);

  /* Timer starts on first keystroke */
  useEffect(() => {
    if (testStatus !== "active" || !typing.startTime || timerStarted) return;
    setTimerStarted(true);
    setTimeLeft(duration);
  }, [testStatus, typing.startTime, timerStarted, duration]);

  /* Countdown when timer has started */
  useEffect(() => {
    if (testStatus !== "active" || !timerStarted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
            if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            const session = endSessionRef.current?.();
            if (session) {
              const metrics = getSessionMetrics(session);
              saveTestResult({
                wpm: metrics.wpm,
                rawWpm: metrics.rawWpm,
                accuracy: metrics.accuracy,
                errors: metrics.errors,
                chars: metrics.chars,
                duration,
                date: new Date().toISOString(),
              });
              updateStreak();
            }
            setTestStatus("finished");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [testStatus, timerStarted, duration]);

  const startTest = useCallback(() => {
    hasEndedRef.current = false;
    prevSettingsRef.current = { duration, includePunctuation, includeNumbers };
    generateAndLoadTest();
    setTestStatus("active");
  }, [generateAndLoadTest]);

  const backToSetup = useCallback(() => {
    clearInterval(timerRef.current);
    setTestStatus("setup");
    setTimerStarted(false);
    typingRef.current?.reset();
  }, []);

  const handleNewTest = useCallback(() => {
    if (testStatus !== "active") return;
    regenerateTest();
  }, [testStatus, regenerateTest]);

  const retryWithSameSettings = useCallback(() => {
    hasEndedRef.current = false;
    generateAndLoadTest();
    setTestStatus("active");
  }, [generateAndLoadTest]);

  const cycleDuration = useCallback(() => {
    const idx = DURATION_OPTIONS.indexOf(duration as (typeof DURATION_OPTIONS)[number]);
    const next = DURATION_OPTIONS[(idx + 1) % DURATION_OPTIONS.length];
    setDuration(next);
  }, [duration]);

  /* ── Finished: show results ─────────────────────────────────────────── */
  if (testStatus === "finished" && typing.report) {
    return (
      <div className="test-results-wrap">
        <SessionReportCard
          report={typing.report}
          onRetry={retryWithSameSettings}
          onHome={onBack}
        />
        <div className="test-results-actions">
          <Button variant="secondary" onClick={backToSetup}>
            Change Settings
          </Button>
        </div>
      </div>
    );
  }

  /* ── Setup: pre-test card ───────────────────────────────────────────── */
  if (testStatus === "setup") {
    return (
      <div className="test-setup">
        <div className="test-setup-card">
          <div className="test-setup-title">WPM Test</div>
          <div className="test-setup-sub">Configure your test, then start when ready.</div>

          <div className="test-setup-section">
            <div className="test-setup-label">Duration</div>
            <div className="test-setup-duration">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`test-setup-duration-btn ${duration === d ? "active" : ""}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div className="test-setup-section">
            <div className="test-setup-label">Include</div>
            <div className="test-setup-toggles">
              <button
                type="button"
                className={`test-setup-toggle ${includePunctuation ? "active" : ""}`}
                onClick={() => setIncludePunctuation((p) => !p)}
              >
                Punctuation
              </button>
              <button
                type="button"
                className={`test-setup-toggle ${includeNumbers ? "active" : ""}`}
                onClick={() => setIncludeNumbers((n) => !n)}
              >
                Numbers
              </button>
            </div>
          </div>

          <div className="test-setup-actions">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button variant="primary" onClick={startTest}>
              Start Test
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Active: Learn-style layout (lesson-stage-root) ──────────────────── */
  const timerPct = timeLeft / duration;
  const timerClass =
    timerPct > 0.5 ? "ok" : timerPct > 0.25 ? "warn" : "critical";

  return (
    <div className="lesson-stage-root lesson-stage-root--with-timer test--active">
      <div className="lesson-stage-topbar test-topbar">
        <button
          type="button"
          className="lesson-stage-topbar__back"
          onClick={backToSetup}
        >
          ← exit
        </button>
        <div className="test-topbar-controls">
          <button
            type="button"
            className="test-topbar-duration-btn"
            onClick={cycleDuration}
            title="Change duration"
          >
            {duration}s
          </button>
          <button
            type="button"
            className={`test-topbar-badge ${includePunctuation ? "on" : "off"}`}
            onClick={() => setIncludePunctuation((p) => !p)}
          >
            punct
          </button>
          <button
            type="button"
            className={`test-topbar-badge ${includeNumbers ? "on" : "off"}`}
            onClick={() => setIncludeNumbers((n) => !n)}
          >
            nums
          </button>
          <button
            type="button"
            className="test-topbar-new-btn"
            onClick={handleNewTest}
            title="New test"
          >
            new
          </button>
        </div>
        <div className={`test-topbar-timer test-topbar-timer--${timerClass}`}>
          {timerStarted ? timeLeft : duration}s
        </div>
      </div>

      <div className="test-timer-bar">
        <div
          className={`test-timer-fill test-timer-fill--${timerClass}`}
          style={{
            width: `${(timerStarted ? timeLeft : duration) / duration * 100}%`,
          }}
        />
      </div>

      <div className="lesson-stage-body" onClick={typing.focus}>
        <input
          ref={typing.inputRef}
          onKeyDown={typing.handleKeyDown}
          className="test-hidden-input"
          readOnly
        />

        <div className="lesson-stage-content-col">
          {!timerStarted && (
            <div className="test-idle-hint mono-label">
              Start typing — timer begins on first keypress
            </div>
          )}

          <div
            className={`test-typing-wrap${textTransitioning ? " test-typing-wrap--transitioning" : ""}`}
          >
            <TypingDisplay
              target={text}
              typed={typing.typed}
            />
          </div>

          {settings?.showKeyboard !== false && (
            <div className="lesson-stage-keyboard-wrap">
              <Keyboard
                layoutType={settings?.keyboardLayout ?? "mac"}
                highlightKey=""
                pressedKey={typing.pressedKey}
                showFingerHints={false}
                mode="test"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
