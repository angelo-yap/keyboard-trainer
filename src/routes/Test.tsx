import { useState, useEffect, useRef, useCallback } from "react";
import { useTypingSession } from "../hooks/useTypingSession";
import type { TypingReplayEvent } from "../hooks/useTyping";
import type { SessionState } from "../core/session/sessionTypes";
import { getWeakLetterTargets } from "../core/storage/keyStatsStore";
import {
  generateTestText,
  generateWordChunk,
  validateTestModeConfig,
  type AdaptiveWeakLetterGeneratorOptions,
  type ClassicWordsGeneratorOptions,
  type CodeSnippetGeneratorOptions,
  type QuotesGeneratorOptions,
  type TestMode,
  type TestModeConfig,
  type TestModeOptionsMap,
} from "../core/test/testTextGenerator";
import { getRandomLocalCodeSnippet } from "../core/test/providers/codeSnippetProvider";
import { fetchQuote, type QuoteFetchResult } from "../core/test/providers/quoteProvider";
import { saveTestResult } from "../core/storage/testHistoryStore";
import { updateStreak } from "../core/storage/streakStore";
import { Keyboard, type KeyboardFingerMarker } from "../ui/components/keyboard";
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

type TestStatus = "setup" | "active" | "finished" | "replay";
type QuoteStatus = Pick<QuoteFetchResult, "sourceType" | "failureReason"> & {
  author: string;
  source: string;
};
type CodeStatus = {
  language: string;
  source: string;
};

type TestReplaySnapshot = {
  target: string;
  events: TypingReplayEvent[];
};

type TestProps = {
  onBack: () => void;
  onStatsChange?: () => void;
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
const REPLAY_KEY_HOLD_MS = 140;

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
  quotes: (options) => ({
    mode: "quotes",
    options,
  }),
  code: (options) => ({
    mode: "code",
    options,
  }),
};

function buildReplaySnapshot(
  target: string,
  events: TypingReplayEvent[],
  session?: SessionState | null,
): TestReplaySnapshot | null {
  if (events.length === 0) return null;

  const maxEventIndex = events.reduce((max, event) => Math.max(max, event.index), -1);
  const maxSessionIndex = session?.keystrokes.reduce(
    (max, event) => Math.max(max, event.index),
    -1,
  ) ?? -1;
  const replayTargetLength = Math.max(maxEventIndex, maxSessionIndex) + 1;

  return {
    target: target.length >= replayTargetLength
      ? target
      : target.padEnd(replayTargetLength, " "),
    events: events.map((event) => ({ ...event })),
  };
}

function normalizeReplayPressedKey(event: TypingReplayEvent): string {
  if (event.action === "backspace") return "backspace";
  return event.key === " " ? " " : event.key.toLowerCase();
}

function getReplayLedKeys(event: TypingReplayEvent): string[] {
  if (event.action === "backspace") return ["backspace"];
  const key = event.typedChar ?? event.key;
  const guidedKeys = getGuidanceKeysForChar(key);
  return guidedKeys.length > 0 ? guidedKeys : [key];
}

export function Test({ onBack, onStatsChange, settings, initialMode = "standard" }: TestProps) {
  const defaultModeOptions = useRef<TestModeOptionsMap>({
    standard: {
      includePunctuation: false,
      includeNumbers: false,
      randomCase: false,
    },
    adaptive: {
      includePunctuation: false,
      includeNumbers: false,
      randomCase: false,
      adaptiveTargets: [],
    },
    quotes: {
      includePunctuation: true,
      includeNumbers: true,
      randomCase: false,
    },
    code: {
      includePunctuation: true,
      includeNumbers: true,
      randomCase: false,
    },
  });
  const [testStatus, setTestStatus] = useState<TestStatus>("setup");
  const [mode, setMode] = useState<TestMode>(initialMode);
  const [duration, setDuration] = useState(settings?.testDuration || 60);
  const [modeOptions, setModeOptions] = useState<TestModeOptionsMap>(defaultModeOptions.current);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [timerStarted, setTimerStarted] = useState(false);
  const [textTransitioning, setTextTransitioning] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [restartArmed, setRestartArmed] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [replaySnapshot, setReplaySnapshot] = useState<TestReplaySnapshot | null>(null);
  const [replayTyped, setReplayTyped] = useState("");
  const [replayPressedKey, setReplayPressedKey] = useState("");
  const [replayActiveKeys, setReplayActiveKeys] = useState<string[]>([]);
  const [replayEventIndex, setReplayEventIndex] = useState(0);
  const [replayRunning, setReplayRunning] = useState(false);
  const [replayRunId, setReplayRunId] = useState(0);
  // server hand tracking data
  const [verdict, setVerdict] = useState<"GOOD" | "BAD" | "IDLE" | "">("");
  const [wrongFingers, setWrongFingers] = useState<string[]>([]);
  const [fingerMarkers, setFingerMarkers] = useState<KeyboardFingerMarker[]>([]);

  useEffect(() => {
    if (testStatus === "setup") {
      setMode(initialMode);
    }
  }, [initialMode, testStatus]);

  useEffect(() => {
    if (testStatus === "setup" && mode === "quotes" && settings.quotesModeEnabled === false) {
      setMode("standard");
    }
    if (testStatus === "setup" && mode === "code" && settings.codeModeEnabled === false) {
      setMode("standard");
    }
  }, [mode, settings.codeModeEnabled, settings.quotesModeEnabled, testStatus]);

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
    randomCase: false,
  });
  const adaptiveTargetsRef = useRef(getWeakLetterTargets(5));
  const modeConfigRef = useRef<TestModeConfig>(
    MODE_CONFIG_BUILDERS[initialMode](defaultModeOptions.current[initialMode] as never, adaptiveTargetsRef.current)
  );
  const typingRef = useRef<{ reset: () => void } | null>(null);
  const refillingRef = useRef(false);
  const lastGuidedKeyRef = useRef<string | null>(null);
  const replayEventsRef = useRef<TypingReplayEvent[]>([]);
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
  const randomCase = modeOptions[mode].randomCase;
  const quoteModeAvailable = settings.quotesModeEnabled !== false;
  const codeModeAvailable = settings.codeModeEnabled !== false;
  const isFinitePassageMode = mode === "quotes" || mode === "code";
  const handTrackingEnabled = settings.handTrackingEnabled !== false;
  if (testStatus === "setup") {
    modeConfigRef.current = createModeConfig(mode);
  }

  const maybeRefill = useCallback((typedLength: number) => {
    if (modeConfigRef.current.mode === "quotes" || modeConfigRef.current.mode === "code") return;

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

  const handleFiniteModeComplete = useCallback((
    stats: import("../hooks/useTyping").TypingStats,
    session: SessionState,
  ) => {
    if (hasEndedRef.current) return;

    hasEndedRef.current = true;
    setReplaySnapshot(buildReplaySnapshot(text, replayEventsRef.current, session));
    saveTestResult({
      wpm: stats.wpm,
      rawWpm: stats.rawWpm,
      accuracy: stats.accuracy,
      errors: stats.errors,
      chars: stats.chars,
      elapsed: stats.elapsed,
      date: new Date().toISOString(),
      completed: true,
      testMode: mode,
      contentTitle: mode === "quotes" ? quoteStatus?.source : codeStatus?.source,
      contentAuthor: mode === "quotes" ? quoteStatus?.author : undefined,
      contentLanguage: mode === "code" ? codeStatus?.language : undefined,
    });
    updateStreak();
    onStatsChange?.();
    setTestStatus("finished");
  }, [codeStatus, mode, onStatsChange, quoteStatus, text]);

  const recordReplayEvent = useCallback((event: TypingReplayEvent) => {
    replayEventsRef.current.push(event);
  }, []);

  const typing = useTypingSession({
    text,
    enabled: testStatus === "active",
    sessionType: "test",
    // Timed modes are ended by the countdown. Quotes/code modes are finite passages.
    onComplete: isFinitePassageMode ? handleFiniteModeComplete : undefined,
    onProgress: ({ typedLength }) => {
      maybeRefill(typedLength);
    },
    onReplayEvent: recordReplayEvent,
  });
  const latestStatsRef = useRef(typing.liveStats);

  useEffect(() => {
    latestStatsRef.current = typing.liveStats;
  }, [typing.liveStats]);

  endSessionRef.current = typing.endSessionEarly;
  typingRef.current = typing;

  /* Centralized: generate new test from current settings and reset session */
  const generateAndLoadTest = useCallback((config: TestModeConfig = modeConfigRef.current) => {
    const newText = generateTestText({
      durationSeconds: duration,
      ...config,
    });
    replayEventsRef.current = [];
    setReplaySnapshot(null);
    setReplayTyped("");
    setReplayPressedKey("");
    setReplayActiveKeys([]);
    setReplayEventIndex(0);
    setReplayRunning(false);
    setReplayRunId(0);
    startRef.current = null;
    pauseStartedAtRef.current = null;
    pausedDurationMsRef.current = 0;
    setText(newText);
    setTimeLeft(duration);
    setTimerStarted(false);
    typingRef.current?.reset();
  }, [duration]);

  const withPreparedQuote = useCallback(async (config: TestModeConfig): Promise<TestModeConfig> => {
    if (config.mode !== "quotes") return config;

    setQuoteLoading(true);

    try {
      const result = await fetchQuote({ timeoutMs: 900, retries: 0 });
      setQuoteStatus({
        author: result.quote.author,
        source: result.quote.source,
        sourceType: result.sourceType,
        failureReason: result.failureReason,
      });

      return {
        mode: "quotes",
        options: {
          ...config.options,
          quote: result.quote,
        },
      };
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const withPreparedCodeSnippet = useCallback((config: TestModeConfig): TestModeConfig => {
    if (config.mode !== "code") return config;

    const snippet = getRandomLocalCodeSnippet();
    setCodeStatus({
      language: snippet.language,
      source: snippet.source,
    });

    return {
      mode: "code",
      options: {
        ...config.options,
        snippet,
      },
    };
  }, []);

  /* Regenerate during active test — used by settings change and manual new test */
  const regenerateTest = useCallback((config: TestModeConfig = modeConfigRef.current) => {
    if (testStatus !== "active") return undefined;

    setTextTransitioning(true);
    clearInterval(timerRef.current);

    const timeout = setTimeout(() => {
      generateAndLoadTest(config);
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
      prev.includeNumbers !== includeNumbers ||
      prev.randomCase !== randomCase;
    prevSettingsRef.current = {
      duration,
      mode,
      includePunctuation,
      includeNumbers,
      randomCase,
    };
    if (changed) {
      const activeConfig =
        isFinitePassageMode && modeConfigRef.current.mode === mode
          ? modeConfigRef.current
          : createModeConfig(mode);
      modeConfigRef.current = activeConfig;
      const cleanup = regenerateTest(activeConfig);
      return cleanup;
    }
  }, [testStatus, text, duration, mode, includePunctuation, includeNumbers, randomCase, createModeConfig, regenerateTest]);

  const currentTargetChar = testStatus === "active" ? text.charAt(typing.typed.length) : "";
  const guidedTargetKeys = getGuidanceKeysForChar(currentTargetChar);
  const guidedKeySignature = guidedTargetKeys.join("+");
  const currentTargetCharRef = useRef(currentTargetChar);
  const recordHandFormSampleRef = useRef(typing.recordHandFormSample);

  useEffect(() => {
    currentTargetCharRef.current = currentTargetChar;
  }, [currentTargetChar]);

  useEffect(() => {
    recordHandFormSampleRef.current = typing.recordHandFormSample;
  }, [typing.recordHandFormSample]);

  // Drive hardware guidance from the current target character, not from typed key events.
  useEffect(() => {
    if (testStatus !== "active") {
      if (lastGuidedKeyRef.current !== null) {
        lastGuidedKeyRef.current = null;
        void resetKeyboardLed();
      }
      return;
    }

    if (guidedTargetKeys.length === 0 || guidedKeySignature === lastGuidedKeyRef.current) {
      return;
    }

    lastGuidedKeyRef.current = guidedKeySignature;
    void sendKeyboardLedForKeys(guidedTargetKeys);
  }, [testStatus, guidedKeySignature, guidedTargetKeys]);

  /* Timer starts on first keystroke */
  useEffect(() => {
    if (testStatus !== "active" || !typing.startTime || timerStarted) return;
    startRef.current = Date.now();
    setTimerStarted(true);
    setTimeLeft(duration);
  }, [testStatus, typing.startTime, timerStarted, duration]);

  // Hand-tracking: connect while the test is active, reset verdict on teardown
  useEffect(() => {
    if (testStatus !== "active" || !handTrackingEnabled) {
      setVerdict("");
      setWrongFingers([]);
      setFingerMarkers([]);
      setShowCamera(false);
      return;
    }

    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        verdict: "GOOD" | "BAD" | "IDLE";
        wrong_fingers: string[];
        finger_positions?: KeyboardFingerMarker[];
      };
      setVerdict(data.verdict);
      setWrongFingers(data.wrong_fingers);
      setFingerMarkers(
        (data.finger_positions ?? []).filter(
          (finger) =>
            typeof finger.label === "string" &&
            Number.isFinite(finger.x) &&
            Number.isFinite(finger.y),
        ),
      );
      recordHandFormSampleRef.current({
        verdict: data.verdict,
        expectedKey: currentTargetCharRef.current,
        wrongFingers: data.wrong_fingers ?? [],
      });
    };

    ws.onerror = () => {
      setVerdict("");
      setWrongFingers([]);
      setFingerMarkers([]);
    };

    return () => ws.close();
  }, [handTrackingEnabled, testStatus]);

  /* Countdown — 100ms interval against a fixed start timestamp, not integer decrement */
  useEffect(() => {
    if (testStatus !== "active" || isFinitePassageMode) return;
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
          setReplaySnapshot(buildReplaySnapshot(text, replayEventsRef.current, session));
          const metrics = latestStatsRef.current;
          saveTestResult({
            wpm: metrics.wpm,
            rawWpm: metrics.rawWpm,
            accuracy: metrics.accuracy,
            errors: metrics.errors,
            chars: metrics.chars,
            duration,
            date: new Date().toISOString(),
            completed: true,
            testMode: mode,
          });
          updateStreak();
          onStatsChange?.();
        }
        setTestStatus("finished");
      }
    }, 100);
    return () => clearInterval(interval);
  }, [testStatus, duration, isFinitePassageMode, mode, onStatsChange, text]);

  const startTest = useCallback(async () => {
    hasEndedRef.current = false;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const preparedConfig = withPreparedCodeSnippet(await withPreparedQuote(nextConfig));
    const validatedConfig = validateModeConfig(preparedConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    prevSettingsRef.current = {
      duration,
      mode,
      includePunctuation: validatedConfig.options.includePunctuation,
      includeNumbers: validatedConfig.options.includeNumbers,
      randomCase: validatedConfig.options.randomCase,
    };
    generateAndLoadTest(validatedConfig);
    setTestStatus("active");
  }, [createModeConfig, duration, generateAndLoadTest, mode, validateModeConfig, withPreparedCodeSnippet, withPreparedQuote]);

  const backToSetup = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = null;
    pauseStartedAtRef.current = null;
    pausedDurationMsRef.current = 0;
    replayEventsRef.current = [];
    setReplaySnapshot(null);
    setReplayTyped("");
    setReplayPressedKey("");
    setReplayActiveKeys([]);
    setReplayEventIndex(0);
    setReplayRunning(false);
    setReplayRunId(0);
    setTestStatus("setup");
    setTimerStarted(false);
    typingRef.current?.reset();
  }, []);

  const handleNewTest = useCallback(async () => {
    if (testStatus !== "active") return;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const preparedConfig = withPreparedCodeSnippet(await withPreparedQuote(nextConfig));
    const validatedConfig = validateModeConfig(preparedConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    regenerateTest(validatedConfig);
  }, [createModeConfig, mode, testStatus, regenerateTest, validateModeConfig, withPreparedCodeSnippet, withPreparedQuote]);

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

  const retryWithSameSettings = useCallback(async () => {
    hasEndedRef.current = false;
    const nextAdaptiveTargets = mode === "adaptive" ? getWeakLetterTargets(5) : [];
    adaptiveTargetsRef.current = nextAdaptiveTargets;
    const nextConfig = createModeConfig(mode, nextAdaptiveTargets);
    const preparedConfig = withPreparedCodeSnippet(await withPreparedQuote(nextConfig));
    const validatedConfig = validateModeConfig(preparedConfig);
    if (!validatedConfig) return;
    modeConfigRef.current = validatedConfig;
    generateAndLoadTest(validatedConfig);
    setTestStatus("active");
  }, [createModeConfig, generateAndLoadTest, mode, validateModeConfig, withPreparedCodeSnippet, withPreparedQuote]);

  const cycleDuration = useCallback(() => {
    const idx = DURATION_OPTIONS.indexOf(duration as (typeof DURATION_OPTIONS)[number]);
    const next = DURATION_OPTIONS[(idx + 1) % DURATION_OPTIONS.length];
    setDuration(next);
  }, [duration]);

  const updateCurrentWordOptions = useCallback(
    (
      updater: (
        current: ClassicWordsGeneratorOptions | AdaptiveWeakLetterGeneratorOptions | QuotesGeneratorOptions | CodeSnippetGeneratorOptions
      ) => ClassicWordsGeneratorOptions | AdaptiveWeakLetterGeneratorOptions | QuotesGeneratorOptions | CodeSnippetGeneratorOptions
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

  const syncCapsLockState = useCallback(
    (event: Pick<KeyboardEvent, "getModifierState"> | React.KeyboardEvent<HTMLInputElement>) => {
      setCapsLockOn(event.getModifierState("CapsLock"));
    },
    [],
  );

  useEffect(() => {
    if (testStatus !== "active") return;

    const onKeyboardEvent = (event: KeyboardEvent) => {
      syncCapsLockState(event);
    };
    const onWindowBlur = () => setCapsLockOn(false);

    window.addEventListener("keydown", onKeyboardEvent);
    window.addEventListener("keyup", onKeyboardEvent);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onKeyboardEvent);
      window.removeEventListener("keyup", onKeyboardEvent);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [syncCapsLockState, testStatus]);

  const handleActiveInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      syncCapsLockState(e);

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

      if (restartArmed && (e.key === " " || e.code === "Space")) {
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
    [armRestart, clearRestartArm, handleNewTest, restartArmed, syncCapsLockState, typing]
  );

  const handleActiveInputKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      syncCapsLockState(e);
    },
    [syncCapsLockState],
  );

  const handleTypingAreaClick = useCallback(() => {
    if (restartArmed) {
      clearRestartArm();
      typing.focus();
      return;
    }

    typing.focus();
  }, [clearRestartArm, restartArmed, typing]);

  const startReplay = useCallback(() => {
    if (!replaySnapshot) return;
    setReplayTyped("");
    setReplayPressedKey("");
    setReplayActiveKeys([]);
    setReplayEventIndex(0);
    setReplayRunning(true);
    setReplayRunId((id) => id + 1);
    setTestStatus("replay");
  }, [replaySnapshot]);

  const returnToResults = useCallback(() => {
    setReplayRunning(false);
    setReplayPressedKey("");
    setReplayActiveKeys([]);
    setTestStatus("finished");
    void resetKeyboardLed();
  }, []);

  useEffect(() => {
    if (testStatus !== "replay" || !replaySnapshot || replayRunId === 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    setReplayTyped("");
    setReplayPressedKey("");
    setReplayActiveKeys([]);
    setReplayEventIndex(0);
    void resetKeyboardLed();

    replaySnapshot.events.forEach((event, index) => {
      const timer = setTimeout(() => {
        if (cancelled) return;

        setReplayTyped(event.typedAfter);
        setReplayEventIndex(index + 1);
        setReplayPressedKey(normalizeReplayPressedKey(event));
        const replayKeys = getReplayLedKeys(event);
        setReplayActiveKeys(replayKeys);
        if (replayKeys.length > 0) {
          void sendKeyboardLedForKeys(replayKeys);
        }

        const clearPressedTimer = setTimeout(() => {
          if (!cancelled) {
            setReplayPressedKey("");
          }
        }, REPLAY_KEY_HOLD_MS);
        timers.push(clearPressedTimer);

        if (index === replaySnapshot.events.length - 1) {
          const doneTimer = setTimeout(() => {
            if (cancelled) return;
            setReplayRunning(false);
            setReplayPressedKey("");
          }, REPLAY_KEY_HOLD_MS);
          timers.push(doneTimer);
        }
      }, event.time);
      timers.push(timer);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      setReplayPressedKey("");
      setReplayActiveKeys([]);
      void resetKeyboardLed();
    };
  }, [replayRunId, replaySnapshot, testStatus]);

  /* ── Finished: show results ─────────────────────────────────────────── */
  if (testStatus === "finished" && typing.report) {
    return (
      <div className="test-results-page">
        <SessionReportCard
          report={typing.report}
          onRetry={() => {
            void retryWithSameSettings();
          }}
          onReplay={replaySnapshot ? startReplay : undefined}
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

  if (testStatus === "replay" && replaySnapshot) {
    const replayProgress =
      replaySnapshot.events.length > 0
        ? replayEventIndex / replaySnapshot.events.length
        : 0;
    const replayNextTarget = replaySnapshot.target.charAt(replayTyped.length);
    const replayGuidedKeys =
      replayActiveKeys.length > 0
        ? replayActiveKeys
        : getGuidanceKeysForChar(replayNextTarget);

    return (
      <div className="lesson-stage-root lesson-stage-root--with-timer test--active test--replay">
        <div className="lesson-stage-topbar test-topbar">
          <button
            type="button"
            className="lesson-stage-topbar__back"
            onClick={returnToResults}
          >
            ← results
          </button>
          <div className="test-topbar-controls">
            <div className="test-topbar-badge on">replay</div>
            <button
              type="button"
              className="test-topbar-new-btn"
              onClick={startReplay}
              title="Restart replay"
            >
              restart
            </button>
          </div>
          <div className="test-topbar-timer">
            {Math.round(replayProgress * 100)}%
          </div>
        </div>

        <div className="test-progress-bar">
          <div
            className="test-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, replayProgress * 100))}%` }}
          />
        </div>

        <div className="lesson-stage-body">
          <div className="lesson-stage-content-col">
            <div className="test-meta-row" aria-live="polite">
              <div className="test-restart-hint mono-label">
                {replayRunning ? "replaying keystrokes" : "replay complete"}
              </div>
              <div className="test-quote-source mono-label">
                {replayEventIndex} / {replaySnapshot.events.length}
              </div>
            </div>

            <div className="test-typing-stage">
              <div className="test-typing-wrap test-typing-wrap--replay">
                <TypingDisplay
                  target={replaySnapshot.target}
                  typed={replayTyped}
                  mode="viewport"
                />
              </div>
            </div>

            {settings?.showKeyboard !== false && (
              <div className="lesson-stage-keyboard-wrap">
                <Keyboard
                  layoutType={settings?.keyboardLayout ?? "mac"}
                  highlightKeys={replayGuidedKeys}
                  pressedKey={replayPressedKey}
                  showFingerHints={settings?.showFingerHints !== false}
                  mode="test"
                />
              </div>
            )}
          </div>
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
                  Prioritizes weaker letters.
                </span>
              </button>
              {quoteModeAvailable && (
                <button
                  type="button"
                  className={`test-setup-mode-card ${mode === "quotes" ? "active" : ""}`}
                  onClick={() => setMode("quotes")}
                >
                  <span className="test-setup-mode-card__title">Quotes</span>
                  <span className="test-setup-mode-card__body">
                    Quotes from famous people and books.
                  </span>
                </button>
              )}
              {codeModeAvailable && (
                <button
                  type="button"
                  className={`test-setup-mode-card ${mode === "code" ? "active" : ""}`}
                  onClick={() => setMode("code")}
                >
                  <span className="test-setup-mode-card__title">Code</span>
                  <span className="test-setup-mode-card__body">
                    Popular algorithms across different languages.
                  </span>
                </button>
              )}
            </div>
          </div>

          {!isFinitePassageMode && (
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
          )}

          {!isFinitePassageMode && (
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
                <button
                  type="button"
                  className={`test-setup-toggle ${randomCase ? "active" : ""}`}
                  onClick={() =>
                    updateCurrentWordOptions((current) => ({
                      ...current,
                      randomCase: !current.randomCase,
                    }))
                  }
                >
                  Random Case
                </button>
              </div>
            </div>
          )}

          <div className="test-setup-actions">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="primary"
              disabled={quoteLoading}
              onClick={() => {
                void startTest();
              }}
            >
              {quoteLoading ? "Loading..." : "Start Test"}
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
          {!isFinitePassageMode && (
            <button
              type="button"
              className="test-topbar-duration-btn"
              onClick={cycleDuration}
              title="Change duration"
            >
              {duration}s
            </button>
          )}
          {!isFinitePassageMode && (
            <>
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
                className={`test-topbar-badge ${randomCase ? "on" : "off"}`}
                onClick={() =>
                  updateCurrentWordOptions((current) => ({
                    ...current,
                    randomCase: !current.randomCase,
                  }))
                }
              >
                case
              </button>
            </>
          )}
          <button
            type="button"
            className="test-topbar-new-btn"
            onClick={() => {
              void handleNewTest();
            }}
            title="New test"
          >
            new
          </button>
          {handTrackingEnabled && (
            <button
              type="button"
              className={`test-topbar-badge ${showCamera ? "on" : "off"}`}
              onClick={() => setShowCamera((v) => !v)}
              title="Toggle camera panel"
            >
              cam
            </button>
          )}
        </div>
        {!isFinitePassageMode && (
          <div className={`test-topbar-timer test-topbar-timer--${timerClass}`}>
            {timerStarted ? timeLeft : duration}s
          </div>
        )}
      </div>

      {isFinitePassageMode ? (
        <div className="test-progress-bar">
          <div
            className="test-progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, typing.progress * 100))}%`,
            }}
          />
        </div>
      ) : (
        <div className="test-timer-bar">
          <div
            className={`test-timer-fill test-timer-fill--${timerClass}`}
            style={{
              width: `${(timerStarted ? timeLeft : duration) / duration * 100}%`,
            }}
          />
        </div>
      )}

      <div className="lesson-stage-body" onClick={handleTypingAreaClick}>
        <input
          ref={typing.inputRef}
          onKeyDown={handleActiveInputKeyDown}
          onKeyUp={handleActiveInputKeyUp}
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
            {mode === "quotes" && quoteStatus && (
              <div
                className="test-quote-source mono-label"
                title={quoteStatus.failureReason ?? `${quoteStatus.sourceType} · ${quoteStatus.source}`}
              >
                {quoteStatus.author} · {quoteStatus.source}
              </div>
            )}
            {mode === "code" && codeStatus && (
              <div
                className="test-quote-source mono-label"
                title={codeStatus.source}
              >
                {codeStatus.language} · {codeStatus.source}
              </div>
            )}
          </div>
          {!timerStarted && (
            <div className="test-idle-hint mono-label">
              {isFinitePassageMode
                ? `Start typing to begin the ${mode === "code" ? "snippet" : "quote"}`
                : "Start typing — timer begins on first keypress"}
            </div>
          )}
          {mode === "quotes" && quoteStatus?.failureReason && (
            <div className="test-quote-failure mono-label">
              {quoteStatus.failureReason}
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
                  <div>press space to restart</div>
                  <div>click on the screen to resume</div>
                </div>
              </div>
            )}
          </div>

          {handTrackingEnabled && <FeedbackBanner verdict={verdict} wrongFingers={wrongFingers} />}

          {settings?.showKeyboard !== false && (
            <div className="lesson-stage-keyboard-wrap">
              <Keyboard
                layoutType={settings?.keyboardLayout ?? "mac"}
                highlightKeys={guidedTargetKeys}
                showFingerHints={settings?.showFingerHints !== false}
                mode="test"
                fingerMarkers={handTrackingEnabled ? fingerMarkers : []}
              />
            </div>
          )}

          {handTrackingEnabled && showCamera && <CameraPanel active={testStatus === "active"} />}
        </div>
      </div>
    </div>
  );
}
