import { useState, useEffect, useRef, useCallback } from "react";
import { useTypingSession } from "../hooks/useTypingSession";
import { getWeakLetterTargets } from "../core/storage/keyStatsStore";
import {
  generateTestText,
  generateWordChunk,
  validateTestModeConfig,
  type AdaptiveWeakLetterGeneratorOptions,
  type ClassicWordsGeneratorOptions,
  type TestMode,
  type TestModeConfig,
  type TestModeOptionsMap,
} from "../core/test/testTextGenerator";
import { saveTestResult } from "../core/storage/testHistoryStore";
import { updateStreak } from "../core/storage/streakStore";
import { Keyboard } from "../ui/components/keyboard";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { SessionReportCard } from "../ui/components/SessionReport";
import { Button } from "../ui/components/Button";
import type { Settings } from "../core/storage/settingsStore";
import { resetKeyboardLed, sendKeyboardLedForKeys } from "../core/keyboard/keyboardLedBridge";
import { getGuidanceKeysForChar } from "../core/keyboard/keyNormalization";
import { FeedbackBanner } from "../ui/components/FeedbackBanner";
import { CameraPanel } from "../ui/components/CameraPanel";
import "../ui/Layout/LessonStage.css";
import "./Test.css";

type TestStatus = "setup" | "active" | "finished";

type TestProps = {
  onBack: () => void;
  settings: Settings;
  initialMode?: TestMode;
};

const DURATION_OPTIONS = [15, 30, 60, 120] as const;
const TRANSITION_MS = 180;

/**
 * How many characters ahead of the cursor we maintain as a buffer.
 * When remaining chars drops below this, we append more words.
 */
const BUFFER_AHEAD_CHARS = 300;
const REFILL_WORD_COUNT = 30;
const DEFAULT_MODE_OPTIONS: TestModeOptionsMap = {
  standard: {
    includePunctuation: false,
    includeNumbers: false,
  },
  adaptive: {
    includePunctuation: false,
    includeNumbers: false,
    adaptiveTargets: [],
  },
};

const MODE_CONFIG_BUILDERS: {
  [K in TestMode]: (
    options: TestModeOptionsMap[K],
    adaptiveTargets: ReturnType<typeof getWeakLetterTargets>
  ) => Extract<TestModeConfig, { mode: K }>;
} = {
  standard: (options) => ({
    mode: "standard",
    options,
  }),
  adaptive: (options, adaptiveTargets) => ({
    mode: "adaptive",
    options: {
      ...options,
      adaptiveTargets,
    },
  }),
};

export function Test({ onBack, settings, initialMode = "standard" }: TestProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>("setup");
  const [mode, setMode] = useState<TestMode>(initialMode);
  const [duration, setDuration] = useState(settings?.testDuration || 60);
  const [modeOptions, setModeOptions] = useState<TestModeOptionsMap>(DEFAULT_MODE_OPTIONS);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [timerStarted, setTimerStarted] = useState(false);
  const [textTransitioning, setTextTransitioning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [restartArmed, setRestartArmed] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  // server hand tracking data
  const [verdict, setVerdict] = useState<"GOOD" | "BAD" | "IDLE" | "">("");
  const [wrongFingers, setWrongFingers] = useState<string[]>([]);

  useEffect(() => {
    if (testStatus === "setup") {
      setMode(initialMode);
    }
  }, [initialMode, testStatus]);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const endSessionRef = useRef<() => import("../core/session/sessionTypes").SessionState | null>(null);
  const hasEndedRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedDurationMsRef = useRef(0);
  const prevSettingsRef = useRef({
    duration,
    mode,
    includePunctuation: false,
    includeNumbers: false,
  });
  const adaptiveTargetsRef = useRef(getWeakLetterTargets(5));
  const modeConfigRef = useRef<TestModeConfig>(
    MODE_CONFIG_BUILDERS[initialMode](DEFAULT_MODE_OPTIONS[initialMode] as never, adaptiveTargetsRef.current)
  );
  const typingRef = useRef<{ reset: () => void } | null>(null);
  const refillingRef = useRef(false);
  const lastGuidedKeyRef = useRef<string | null>(null);
  // Keep current text length in a ref so refill can check without stale closures
  const textLengthRef = useRef(0);
  textLengthRef.current = text.length;

  const createModeConfig = useCallback(
    (
      selectedMode: TestMode,
      adaptiveTargets: ReturnType<typeof getWeakLetterTargets> = adaptiveTargetsRef.current
    ): TestModeConfig =>
      MODE_CONFIG_BUILDERS[selectedMode](
        modeOptions[selectedMode] as never,
        adaptiveTargets
      ),
    [modeOptions]
  );

  const validateModeConfig = useCallback((config: TestModeConfig) => {
    const validation = validateTestModeConfig(config);
    return validation.valid ? validation.options : null;
  }, []);

  const includePunctuation = modeOptions[mode].includePunctuation;
  const includeNumbers = modeOptions[mode].includeNumbers;
  modeConfigRef.current = createModeConfig(mode);

  const maybeRefill = useCallback((typedLength: number) => {
    const remaining = textLengthRef.current - typedLength;

    if (remaining >= BUFFER_AHEAD_CHARS || refillingRef.current) return;

    refillingRef.current = true;

    const chunk = generateWordChunk({
      wordCount: REFILL_WORD_COUNT,
      ...modeConfigRef.current,
    });

    setText((prev) => `${prev} ${chunk}`);

    setTimeout(() => {
      refillingRef.current = false;
    }, 0);
  }, []);

  const typing = useTypingSession({
    text,
    enabled: testStatus === "active",
    sessionType: "test",
    // Timer is the ONLY thing that ends a timed test.
    // Text exhaustion is prevented by the dynamic refill above.
    onComplete: undefined,
    onProgress: ({ typedLength }) => {
      maybeRefill(typedLength);
    },
  });

  endSessionRef.current = typing.endSessionEarly;
  typingRef.current = typing;

  /* Centralized: generate new test from current settings and reset session */
  const generateAndLoadTest = useCallback((config: TestModeConfig = modeConfigRef.current) => {
    const newText = generateTestText({
      durationSeconds: duration,
      ...config,
    });
    startRef.current = null;
    pauseStartedAtRef.current = null;
    pausedDurationMsRef.current = 0;
    setText(newText);
    setTimeLeft(duration);
    setTimerStarted(false);
    typingRef.current?.reset();
  }, [duration]);

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
      prev.mode !== mode ||
      prev.includePunctuation !== includePunctuation ||
      prev.includeNumbers !== includeNumbers;
    prevSettingsRef.current = {
      duration,
      mode,
      includePunctuation,
      includeNumbers,
    };
    if (changed) {
      modeConfigRef.current = createModeConfig(mode);
      const cleanup = regenerateTest();
      return cleanup;
    }
  }, [testStatus, text, duration, mode, includePunctuation, includeNumbers, createModeConfig, regenerateTest]);

  const currentTargetChar = testStatus === "active" ? text.charAt(typing.typed.length) : "";
  const guidedTargetKeys = getGuidanceKeysForChar(currentTargetChar);
  const guidedKeySignature = guidedTargetKeys.join("+");

  // Drive hardware guidance from the current target character, not from typed key events.
  useEffect(() => {
    if (testStatus !== "active") {
      lastGuidedKeyRef.current = null;
      void resetKeyboardLed();
      return;
    }

    if (guidedTargetKeys.length === 0 || guidedKeySignature === lastGuidedKeyRef.current) {
      return;
    }

    lastGuidedKeyRef.current = guidedKeySignature;
    void sendKeyboardLedForKeys(guidedTargetKeys);
  }, [testStatus, guidedTargetKeys, guidedKeySignature]);

  /* Timer starts on first keystroke */
  useEffect(() => {
    if (testStatus !== "active" || !typing.startTime || timerStarted) return;
    startRef.current = Date.now();
    setTimerStarted(true);
    setTimeLeft(duration);
  }, [testStatus, typing.startTime, timerStarted, duration]);

  // Hand-tracking: connect while the test is active, reset verdict on teardown
  useEffect(() => {
    if (testStatus !== "active") {
      setVerdict("");
      setWrongFingers([]);
      return;
    }

    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        verdict: "GOOD" | "BAD" | "IDLE";
        wrong_fingers: string[];
      };
      setVerdict(data.verdict);
      setWrongFingers(data.wrong_fingers);
    };

    ws.onerror = () => {
      setVerdict("");
      setWrongFingers([]);
    };

    return () => ws.close();
  }, [testStatus]);

  /* Countdown — 100ms interval against a fixed start timestamp, not integer decrement */
  useEffect(() => {
    if (testStatus !== "active") return;
    const interval = setInterval(() => {
      if (!startRef.current) return;
      if (pauseStartedAtRef.current) return;
      const elapsed = (Date.now() - startRef.current - pausedDurationMsRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0 && !hasEndedRef.current) {
        clearInterval(interval);
        hasEndedRef.current = true;
        const session = endSessionRef.current?.();
        if (session) {
          const metrics = typing.liveStats;
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
    }, 100);
    return () => clearInterval(interval);
  }, [testStatus, duration]);

  const startTest = useCallback(() => {
    hasEndedRef.current = false;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const validatedConfig = validateModeConfig(nextConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    prevSettingsRef.current = {
      duration,
      mode,
      includePunctuation: validatedConfig.options.includePunctuation,
      includeNumbers: validatedConfig.options.includeNumbers,
    };
    generateAndLoadTest(validatedConfig);
    setTestStatus("active");
  }, [createModeConfig, duration, generateAndLoadTest, mode, validateModeConfig]);

  const backToSetup = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = null;
    pauseStartedAtRef.current = null;
    pausedDurationMsRef.current = 0;
    setTestStatus("setup");
    setTimerStarted(false);
    typingRef.current?.reset();
  }, []);

  const handleNewTest = useCallback(() => {
    if (testStatus !== "active") return;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const validatedConfig = validateModeConfig(nextConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    regenerateTest();
  }, [createModeConfig, mode, testStatus, regenerateTest, validateModeConfig]);

  const clearRestartArm = useCallback(() => {
    if (pauseStartedAtRef.current) {
      pausedDurationMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    setRestartArmed(false);
  }, []);

  const armRestart = useCallback(() => {
    if (timerStarted && startRef.current && !pauseStartedAtRef.current) {
      pauseStartedAtRef.current = Date.now();
    }
    setRestartArmed(true);
  }, [timerStarted]);

  const retryWithSameSettings = useCallback(() => {
    hasEndedRef.current = false;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const validatedConfig = validateModeConfig(nextConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    generateAndLoadTest(validatedConfig);
    setTestStatus("active");
  }, [createModeConfig, generateAndLoadTest, mode, validateModeConfig]);

  const cycleDuration = useCallback(() => {
    const idx = DURATION_OPTIONS.indexOf(duration as (typeof DURATION_OPTIONS)[number]);
    const next = DURATION_OPTIONS[(idx + 1) % DURATION_OPTIONS.length];
    setDuration(next);
  }, [duration]);

  const updateCurrentWordOptions = useCallback(
    (
      updater: (
        current: ClassicWordsGeneratorOptions | AdaptiveWeakLetterGeneratorOptions
      ) => ClassicWordsGeneratorOptions | AdaptiveWeakLetterGeneratorOptions
    ) => {
      setModeOptions((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          ...(updater(current[mode]) as TestModeOptionsMap[typeof mode]),
        },
      }));
    },
    [mode]
  );

  useEffect(() => {
    if (testStatus !== "active") {
      clearRestartArm();
      setCapsLockOn(false);
    }
  }, [clearRestartArm, testStatus]);

  const handleActiveInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      setCapsLockOn(e.getModifierState("CapsLock"));

      if (e.key === "Tab") {
        e.preventDefault();
        armRestart();
        return;
      }

      if (restartArmed && e.key === "Escape") {
        e.preventDefault();
        clearRestartArm();
        return;
      }

      if (restartArmed && e.key === "Enter") {
        e.preventDefault();
        clearRestartArm();
        handleNewTest();
        return;
      }

      if (restartArmed) {
        e.preventDefault();
        clearRestartArm();
        return;
      }

      typing.handleKeyDown(e);
    },
    [armRestart, clearRestartArm, handleNewTest, restartArmed, typing]
  );

  const handleTypingAreaClick = useCallback(() => {
    if (restartArmed) {
      clearRestartArm();
      typing.focus();
      return;
    }

    typing.focus();
  }, [clearRestartArm, restartArmed, typing]);

  /* ── Finished: show results ─────────────────────────────────────────── */
  if (testStatus === "finished" && typing.report) {
    return (
      <div className="test-results-page">
        <SessionReportCard
          report={typing.report}
          onRetry={retryWithSameSettings}
          onHome={onBack}
        />
        <div className="test-results-extra-actions">
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
            <div className="test-setup-label">Mode</div>
            <div className="test-setup-mode-grid">
              <button
                type="button"
                className={`test-setup-mode-card ${mode === "standard" ? "active" : ""}`}
                onClick={() => setMode("standard")}
              >
                <span className="test-setup-mode-card__title">Standard</span>
                <span className="test-setup-mode-card__body">
                  Current mixed-word test flow.
                </span>
              </button>
              <button
                type="button"
                className={`test-setup-mode-card ${mode === "adaptive" ? "active" : ""}`}
                onClick={() => setMode("adaptive")}
              >
                <span className="test-setup-mode-card__title">Adaptive</span>
                <span className="test-setup-mode-card__body">
                  Prioritizes weaker letters when there is enough history.
                </span>
              </button>
            </div>
          </div>

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
                onClick={() =>
                  updateCurrentWordOptions((current) => ({
                    ...current,
                    includePunctuation: !current.includePunctuation,
                  }))
                }
              >
                Punctuation
              </button>
              <button
                type="button"
                className={`test-setup-toggle ${includeNumbers ? "active" : ""}`}
                onClick={() =>
                  updateCurrentWordOptions((current) => ({
                    ...current,
                    includeNumbers: !current.includeNumbers,
                  }))
                }
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
          <div className={`test-topbar-badge ${mode === "adaptive" ? "on" : "off"}`}>
            {mode}
          </div>
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
            onClick={() =>
              updateCurrentWordOptions((current) => ({
                ...current,
                includePunctuation: !current.includePunctuation,
              }))
            }
          >
            punct
          </button>
          <button
            type="button"
            className={`test-topbar-badge ${includeNumbers ? "on" : "off"}`}
            onClick={() =>
              updateCurrentWordOptions((current) => ({
                ...current,
                includeNumbers: !current.includeNumbers,
              }))
            }
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
          <button
            type="button"
            className={`test-topbar-badge ${showCamera ? "on" : "off"}`}
            onClick={() => setShowCamera((v) => !v)}
            title="Toggle camera panel"
          >
            cam
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

      <div className="lesson-stage-body" onClick={handleTypingAreaClick}>
        <input
          ref={typing.inputRef}
          onKeyDown={handleActiveInputKeyDown}
          className="test-hidden-input"
          readOnly
        />

        <div className="lesson-stage-content-col">
          <div className="test-meta-row" aria-live="polite">
            {!restartArmed && (
              <div className="test-restart-hint mono-label">
                tab to restart
              </div>
            )}
            {capsLockOn && <div className="test-caps-indicator mono-label">Caps Lock on</div>}
          </div>
          {!timerStarted && (
            <div className="test-idle-hint mono-label">
              Start typing — timer begins on first keypress
            </div>
          )}

          <div className={`test-typing-stage${restartArmed ? " test-typing-stage--armed" : ""}`}>
            <div
              className={`test-typing-wrap${textTransitioning ? " test-typing-wrap--transitioning" : ""}`}
            >
              <TypingDisplay
                target={text}
                typed={typing.typed}
                mode="viewport"
              />
            </div>
            {restartArmed && (
              <div className="test-restart-overlay" aria-live="polite" aria-label="Restart test confirmation">
                <div className="test-restart-overlay__icon" aria-hidden="true">↻</div>
                <div className="test-restart-overlay__body">
                  <div>press enter to restart</div>
                  <div>click on the screen to resume</div>
                </div>
              </div>
            )}
          </div>

          <FeedbackBanner verdict={verdict} wrongFingers={wrongFingers} />

          {settings?.showKeyboard !== false && (
            <div className="lesson-stage-keyboard-wrap">
              <Keyboard
                layoutType={settings?.keyboardLayout ?? "mac"}
                highlightKeys={guidedTargetKeys}
                showFingerHints={false}
                mode="test"
              />
            </div>
          )}

          {showCamera && <CameraPanel active={testStatus === "active"} />}
        </div>
      </div>
    </div>
  );
}
