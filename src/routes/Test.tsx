import { useState, useEffect, useRef, useCallback } from "react";
import { useTyping } from "../hooks/useTyping";
import { TOP_500 } from "../data/topWords";
import { shuffle } from "../lib/shuffle";
import { saveTestResult } from "../core/storage/testHistoryStore";
import { updateStreak } from "../core/storage/streakStore";
import { KeyboardVisual } from "../ui/components/KeyboardVisual";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { StatBar } from "../ui/components/StatBar";
import { ResultsCard } from "../ui/components/ResultsCard";
import { Button } from "../ui/components/Button";
import type { Settings } from "../core/storage/settingsStore";
import "./Test.css";

function generateText(wordCount = 80): string {
  return shuffle(TOP_500).slice(0, wordCount).join(" ");
}

type TestProps = {
  onBack: () => void;
  settings: Settings;
};

export function Test({ onBack, settings }: TestProps) {
  const [duration, setDuration] = useState(settings?.testDuration || 60);
  const [phase, setPhase] = useState<"idle" | "countdown" | "running" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [text, setText] = useState(() => generateText(80));
  const [result, setResult] = useState<{
    wpm: number;
    rawWpm?: number;
    accuracy: number;
    errors: number;
    chars: number;
    elapsed?: number;
    duration?: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number | null>(null);

  const handleComplete = useCallback(
    (res: { wpm: number; rawWpm?: number; accuracy: number; errors: number; chars: number; elapsed?: number }) => {
      clearInterval(timerRef.current);
      const fullRes = { ...res, duration, date: new Date().toISOString() };
      setResult(fullRes);
      saveTestResult(fullRes);
      updateStreak();
      setPhase("done");
    },
    [duration]
  );

  const typing = useTyping({
    text,
    enabled: phase === "running",
    onComplete: handleComplete,
  });

  useEffect(() => {
    if (typing.startTime && phase === "idle") {
      setPhase("running");
      startTimeRef.current = typing.startTime;
    }
  }, [typing.startTime, phase]);

  useEffect(() => {
    if (phase !== "running") return;
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          const elapsed =
            (Date.now() - (startTimeRef.current || Date.now())) / 1000 / 60;
          const wordCount = typing.typed.trim().split(/\s+/).filter(Boolean).length;
          const wpm = Math.round(wordCount / Math.max(elapsed, 0.01));
          const accuracy = typing.typed.length
            ? Math.round(
                ((typing.typed.length - typing.errors.size) / typing.typed.length) * 100
              )
            : 100;
          handleComplete({
            wpm,
            rawWpm: Math.round(typing.typed.length / 5 / Math.max(elapsed, 0.01)),
            accuracy,
            errors: typing.errors.size,
            chars: typing.typed.length,
            elapsed: elapsed * 60,
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setPhase("idle");
    setTimeLeft(duration);
    setText(generateText(80));
    setResult(null);
    typing.reset();
  }, [duration, typing]);

  useEffect(() => {
    setText(generateText(80));
    setResult(null);
    setPhase("idle");
    setTimeLeft(duration);
    typing.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when duration changes
  }, [duration]);

  if (phase === "done" && result) {
    return (
      <ResultsCard
        result={result}
        title="Test Complete"
        onRetry={reset}
        onBack={onBack}
      />
    );
  }

  const timerPct = timeLeft / duration;
  const timerColor =
    timerPct > 0.5 ? "#ff8c32" : timerPct > 0.25 ? "#e09a54" : "#ff5555";

  return (
    <div className="test">
      <div className="test-controls">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>

        <div className="test-duration">
          {[15, 30, 60, 120].map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`test-duration-btn ${duration === d ? "active" : ""}`}
            >
              {d}s
            </button>
          ))}
        </div>

        <Button variant="secondary" onClick={reset}>
          ↺ New
        </Button>

        <div className="test-timer">
          <div className="test-timer-value" style={{ color: timerColor }}>
            {phase === "idle" ? duration : timeLeft}
          </div>
          <div className="test-timer-label">sec</div>
        </div>
      </div>

      <div className="test-timer-bar">
        <div
          className="test-timer-fill"
          style={{
            width: `${timerPct * 100}%`,
            background: timerColor,
          }}
        />
      </div>

      {phase === "idle" && (
        <div className="test-idle-hint">
          Start typing to begin — timer starts on first keypress
        </div>
      )}

      {phase === "running" && <StatBar stats={typing.liveStats} />}

      <TypingDisplay
        text={text}
        typed={typing.typed}
        errors={typing.errors}
        fontSize={settings?.fontSize || "md"}
        caretStyle={settings?.caretStyle || "block"}
        onClick={typing.focus}
      />

      <input
        ref={typing.inputRef}
        onKeyDown={typing.handleKeyDown}
        className="test-hidden-input"
        readOnly
      />

      {settings?.showKeyboard !== false && (
        <div className="test-keyboard-wrap">
          <KeyboardVisual
            highlightChar={phase === "running" ? typing.currentChar : ""}
            pressedKey={typing.pressedKey}
            showFingerColors={settings?.showFingerHints !== false}
          />
        </div>
      )}
    </div>
  );
}
