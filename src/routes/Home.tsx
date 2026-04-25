/* ─── src/routes/Home.tsx ────────────────────────────────────────────────────
   Home screen: dashboard + integrated typing practice.
   Practice sessions run inline — no separate Practice page.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import "./Home.css";
import "./Test.css";
import { getLessonSummaries } from "../core/lesson/homeData";
import { getFingerMastery } from "../core/lesson/fingerMastery";
import { getCoachMessage } from "../core/lesson/coachMessage";
import { getWeakKeys } from "../core/storage/keyStatsStore";
import {
  getAverageWpm,
  getAverageAccuracy,
  getWpmDeltaThisWeek,
  getAccuracyDeltaThisWeek,
} from "../core/storage/testHistoryStore";
import { getStreak } from "../core/storage/streakStore";
import { savePracticeResult } from "../core/storage/progressStore";
import { PRACTICE_LESSONS } from "../core/lesson/lessons/practiceLessons";
import { useTypingSession } from "../hooks/useTypingSession";
import { getCallout } from "../core/keyboard/getCallout";
import { resetKeyboardLed, sendKeyboardLedForKeys } from "../core/keyboard/keyboardLedBridge";
import { getGuidanceKeysForChar } from "../core/keyboard/keyNormalization";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { SessionReportCard } from "../ui/components/SessionReport";
import { Keyboard } from "../ui/components/keyboard";
import type { Settings } from "../core/storage/settingsStore";
import { formatKeyLabel } from "../core/text/formatChar";

/* ── Types ───────────────────────────────────────────────────────────── */

interface WeakKey {
  key: string;
  accuracy: number;
  score: number;
  avgLatencyMs: number | null;
}

interface HomeProps {
  onTabChange: (tab: "learn" | "test" | "analytics" | "settings") => void;
  onStartAdaptiveTest: () => void;
  settings?: Settings;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function buildText(lesson: (typeof PRACTICE_LESSONS)[0]): string {
  const base = lesson.text;
  let result = "";
  while (result.replace(/\s+$/, "").length < 150) {
    result += base + " ";
  }
  return result.trim().slice(0, 220);
}

const FINGER_KEYS_LEFT = ["a", "s", "d", "f", ""];   /* pinky→index, thumb */
const FINGER_KEYS_RIGHT = ["", "j", "k", "l", ";"];  /* thumb, index→pinky */

/* ── Sub-components ──────────────────────────────────────────────────── */

const MicroStat: React.FC<{
  label: string;
  value: number;
  unit: string;
  delta: number;
  deltaUnit?: string;
}> = ({ label, value, unit, delta, deltaUnit = "" }) => (
  <div className="home-micro-stat">
    <div className="home-micro-stat__label mono-label">{label}</div>
    <div className="home-micro-stat__value">
      {value}
      <span className="home-micro-stat__unit">{unit}</span>
    </div>
    {delta !== 0 && (
      <div className="home-micro-stat__delta">
        {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
        {deltaUnit} this week
      </div>
    )}
  </div>
);

type FingerState = "mastered" | "learning" | "weak" | "unlocked";

const FingerCol: React.FC<{
  label: string;
  state: FingerState;
  keys: string;
  height: number;
}> = ({ label, state, keys, height }) => (
  <div className="hd-finger-col">
    <div
      className={`hd-finger-body hd-finger-body--${state}`}
      style={{ height }}
    >
      <div className="hd-finger-keys">{keys}</div>
    </div>
    <div className="hd-finger-label">{label}</div>
  </div>
);

const HandDiagram: React.FC<{
  mastery: ReturnType<typeof getFingerMastery>;
}> = ({ mastery }) => (
  <div className="hd-root">
    <div className="hd-hand">
      <FingerCol label="L5" state={mastery.L5} keys={"a\nz\nq"} height={44} />
      <FingerCol label="L4" state={mastery.L4} keys={"s\nx\n2"} height={52} />
      <FingerCol label="L3" state={mastery.L3} keys={"d\nc\n3"} height={56} />
      <FingerCol label="L2" state={mastery.L2} keys={"f\nv\n4\nr"} height={62} />
      <div className="hd-finger-col">
        <div className="hd-thumb hd-thumb--left" />
        <div className="hd-finger-label">L1</div>
      </div>
    </div>
    <div className="hd-gap">
      <div className="hd-gap-line" />
    </div>
    <div className="hd-hand">
      <div className="hd-finger-col">
        <div className="hd-thumb hd-thumb--right" />
        <div className="hd-finger-label">R1</div>
      </div>
      <FingerCol label="R2" state={mastery.R2} keys={"j\nm\n7\nu"} height={62} />
      <FingerCol label="R3" state={mastery.R3} keys={"k\n,\n8\ni"} height={56} />
      <FingerCol label="R4" state={mastery.R4} keys={"l\n.\n9"} height={52} />
      <FingerCol label="R5" state={mastery.R5} keys={";\n/\n0\np"} height={44} />
    </div>
    <div className="hd-legend">
      <LegendItem color="correct" label="solid" />
      <LegendItem color="accent" label="learning" />
      <LegendItem color="error" label="weak" />
      <LegendItem color="surface" label="not yet" />
    </div>
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="hd-legend-item">
    <div className={`hd-legend-dot hd-legend-dot--${color}`} />
    <span>{label}</span>
  </div>
);

const ProgressDots: React.FC<{
  lessons: ReturnType<typeof getLessonSummaries>;
}> = ({ lessons }) => (
  <div className="home-progress-dots">
    {lessons.map((l) => (
      <div
        key={l.id}
        className={`home-progress-dot home-progress-dot--${l.status}`}
        title={l.name}
      />
    ))}
  </div>
);

const FINGER_HEIGHTS_LEFT = [44, 52, 56, 62];
const FINGER_HEIGHTS_RIGHT = [62, 56, 52, 44];

const HandCue: React.FC<{
  hand: "left" | "right" | "both";
  activeFingerIndex: number;
}> = ({ hand, activeFingerIndex }) => {
  const thumbActive = activeFingerIndex === -1;

  const renderHand = (
    side: "left" | "right",
    keys: string[],
    getActive: (i: number) => boolean
  ) => (
    <div className="practice-hc-hand" key={side}>
      {keys.map((k, i) => {
        const isThumb = (side === "left" && i === 4) || (side === "right" && i === 0);
        const isActive = isThumb ? thumbActive : getActive(i);
        if (isThumb) {
          return (
            <div
              key="thumb"
              className={`practice-hc-thumb practice-hc-thumb--${side}${isActive ? " practice-hc-thumb--active" : ""}`}
            />
          );
        }
        const h = side === "left" ? FINGER_HEIGHTS_LEFT[i] : FINGER_HEIGHTS_RIGHT[i - 1];
        return (
          <div key={i} className="practice-hc-finger-col">
            <div
              className={`practice-hc-finger${isActive ? " practice-hc-finger--active" : ""}`}
              style={{ height: h }}
            >
              {k}
            </div>
          </div>
        );
      })}
    </div>
  );

  const leftFingerActive = (i: number) => hand === "left" && i === activeFingerIndex;
  const rightFingerActive = (i: number) => hand === "right" && i === activeFingerIndex;

  return (
    <div className="practice-hand-cue practice-hand-cue--both">
      {renderHand("left", FINGER_KEYS_LEFT, leftFingerActive)}
      <div className="practice-hc-gap" />
      {renderHand("right", FINGER_KEYS_RIGHT, rightFingerActive)}
    </div>
  );
};

/* ── Main component ──────────────────────────────────────────────────── */

export const Home: React.FC<HomeProps> = ({ onTabChange, onStartAdaptiveTest, settings }) => {
  const [lessonId, setLessonId] = useState<number | null>(null);
  const lastGuidedKeyRef = useRef<string | null>(null);

  const lessons = getLessonSummaries();
  const weakKeys = getWeakKeys();
  const fingerMastery = getFingerMastery();
  const { message: coachMessage, detail: coachDetail } = getCoachMessage();
  const avgWpm = getAverageWpm();
  const accuracy = getAverageAccuracy();
  const wpmDelta = getWpmDeltaThisWeek();
  const accuracyDelta = getAccuracyDeltaThisWeek();
  const streak = getStreak();

  const lesson = PRACTICE_LESSONS.find((l) => l.id === lessonId);
  const text = lesson ? buildText(lesson) : "";

  const typing = useTypingSession({
    text,
    enabled: !!lesson,
    sessionType: "practice",
    lessonId: lesson ? String(lesson.id) : undefined,
    onComplete: (stats) => {
      if (lesson) {
        savePracticeResult(lesson.id, {
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          date: new Date().toISOString(),
        });
      }
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!lesson || typing.report) return;

      typing.handleKeyDown(e);
    },
    [lesson, typing]
  );

  const nextTargetChar = lesson ? text.charAt(typing.typed.length) : "";
  const guidedTargetKeys = getGuidanceKeysForChar(nextTargetChar);
  const guidedKeySignature = guidedTargetKeys.join("+");

  useEffect(() => {
    if (!lesson || typing.report) {
      lastGuidedKeyRef.current = null;
      void resetKeyboardLed();
      return;
    }

    if (guidedTargetKeys.length === 0 || guidedKeySignature === lastGuidedKeyRef.current) {
      return;
    }

    lastGuidedKeyRef.current = guidedKeySignature;
    void sendKeyboardLedForKeys(guidedTargetKeys);
  }, [lesson, typing.report, guidedTargetKeys, guidedKeySignature]);

  const dayLabel =
    streak.count > 0
      ? `day ${streak.count} — ${new Date().toLocaleDateString("en", { weekday: "long" }).toLowerCase()}`
      : new Date().toLocaleDateString("en", { weekday: "long" }).toLowerCase();

  const activeLesson = useMemo(
    () => lessons.find((l) => l.status === "active"),
    [lessons]
  );

  const startLesson = useCallback((id: number) => setLessonId(id), []);
  const exitSession = useCallback(() => {
    setLessonId(null);
    typing.reset();
  }, [typing]);
  const exitResults = useCallback(() => {
    setLessonId(null);
    typing.reset();
  }, [typing]);

  /* ── Results view ──────────────────────────────────────────────────── */
  if (typing.report && lesson) {
    return (
      <div className="home-results-wrap">
        <SessionReportCard
          report={typing.report}
          onRetry={() => typing.reset()}
          onNextLesson={
            PRACTICE_LESSONS.some((l) => l.id === lessonId! + 1)
              ? () => {
                  const next = PRACTICE_LESSONS.find((l) => l.id === lessonId! + 1);
                  if (next) {
                    setLessonId(next.id);
                    typing.reset();
                  } else {
                    exitResults();
                  }
                }
              : undefined
          }
          onHome={exitResults}
        />
      </div>
    );
  }

  /* ── Practice session view ─────────────────────────────────────────── */
  if (lesson) {
    const callout = nextTargetChar ? getCallout(nextTargetChar) : null;
    return (
      <PracticeSessionView
        lessonNumber={lesson.id}
        lessonName={lesson.name}
        typing={{
          target: text,
          typed: typing.typed,
          progress: typing.progress,
          drillIndex: 0,
          totalDrills: 1,
          isFinished: typing.isComplete,
          pressedKey: typing.pressedKey,
        }}
        callout={callout}
        guidedKeys={guidedTargetKeys}
        settings={settings}
        onKeyDown={handleKeyDown}
        onBack={exitSession}
        onRestart={() => typing.reset()}
      />
    );
  }

  /* ── Dashboard view ────────────────────────────────────────────────── */
  return (
    <div className="home-root">
      <div className="home-main">
        <div className="home-greeting">
          <div className="home-greeting__eyebrow mono-label">{dayLabel}</div>
          <h1 className="home-greeting__headline">
            Good to have you
            <br />
            back, <em>keep going.</em>
          </h1>
          <p className="home-greeting__sub">{coachMessage}</p>
          {coachDetail && (
            <p className="home-greeting__sub home-greeting__sub--detail">
              {coachDetail}
            </p>
          )}
        </div>

        {activeLesson && (
          <div className="home-resume">
            <div className="home-resume__left">
              <div className="home-resume__label mono-label">
                continue where you left off
              </div>
              <div className="home-resume__name">
                Lesson {activeLesson.number} —{" "}
                <em>{activeLesson.name.toLowerCase()}</em>
              </div>
              <div className="home-resume__meta">
                {activeLesson.keys}
                {activeLesson.bestWpm != null && (
                  <> &nbsp;·&nbsp; best {activeLesson.bestWpm} wpm</>
                )}
              </div>
              <ProgressDots lessons={lessons} />
            </div>
            <button
              className="home-resume__btn"
              onClick={() => startLesson(activeLesson.number)}
            >
              begin
            </button>
          </div>
        )}

        <div className="home-resume home-resume--adaptive">
          <div className="home-resume__left">
            <div className="home-resume__label mono-label">test mode</div>
            <div className="home-resume__name">
              Adaptive <em>weak-letter training</em>
            </div>
            <div className="home-resume__meta">
              Focuses future test text on the keys you miss most often.
            </div>
          </div>
          <button
            className="home-resume__btn"
            onClick={onStartAdaptiveTest}
          >
            start adaptive
          </button>
        </div>

        <div className="home-lessons">
          <div className="mono-label home-section-label">all lessons</div>
          <div className="home-lesson-list">
            {lessons.map((lessonSummary) => {
              const locked = lessonSummary.status === "locked";
              return (
                <div
                  key={lessonSummary.id}
                  className={`home-lesson-row home-lesson-row--${lessonSummary.status}`}
                  onClick={() =>
                    !locked && startLesson(lessonSummary.number)
                  }
                >
                  <span className="home-lesson-row__num">
                    {lessonSummary.status === "done" ? "✓" : lessonSummary.number}
                  </span>
                  <span className="home-lesson-row__name">{lessonSummary.name}</span>
                  <span className="home-lesson-row__keys">{lessonSummary.keys}</span>
                  <span
                    className={`home-lesson-row__score${
                      lessonSummary.bestWpm == null ? " home-lesson-row__score--empty" : ""
                    }`}
                  >
                    {lessonSummary.bestWpm != null ? `${lessonSummary.bestWpm} wpm` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="home-aside">
        <div className="home-micro-stats">
          <MicroStat
            label="avg speed"
            value={avgWpm}
            unit=" wpm"
            delta={wpmDelta}
          />
          <MicroStat
            label="accuracy"
            value={accuracy}
            unit="%"
            delta={accuracyDelta}
            deltaUnit="%"
          />
        </div>
        <div className="home-hand-section">
          <div className="mono-label home-section-label">
            your hands — key mastery
          </div>
          <HandDiagram mastery={fingerMastery} />
        </div>
        {weakKeys.length > 0 && (
          <div className="home-weak-keys">
            <div className="mono-label home-section-label">
              keys needing work
            </div>
            <div className="home-weak-list">
              {weakKeys.slice(0, 5).map((wk) => (
                <div key={wk.key} className="home-weak-row">
                  <span className="home-weak-row__key">{formatKeyLabel(wk.key)}</span>
                  <div className="home-weak-row__track">
                    <div
                      className="home-weak-row__fill"
                      style={{ width: `${wk.score}%` }}
                    />
                  </div>
                  <span className="home-weak-row__pct">{wk.score}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Practice session view (inline, no separate page) ────────────────── */

interface PracticeSessionViewProps {
  lessonNumber: number;
  lessonName: string;
  typing: {
    target: string;
    typed: string;
    progress: number;
    drillIndex: number;
    totalDrills: number;
    isFinished: boolean;
    pressedKey?: string;
  };
  callout: ReturnType<typeof getCallout>;
  guidedKeys: string[];
  settings?: Settings;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBack: () => void;
  onRestart: () => void;
}

function PracticeSessionView({
  lessonNumber,
  lessonName,
  typing,
  callout,
  guidedKeys,
  settings,
  onKeyDown,
  onBack,
  onRestart,
}: PracticeSessionViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [restartArmed, setRestartArmed] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  const clearRestartArm = useCallback(() => setRestartArmed(false), []);
  const armRestart = useCallback(() => setRestartArmed(true), []);

  const handleTypingAreaClick = useCallback(() => {
    if (restartArmed) {
      clearRestartArm();
    }
    focusInput();
  }, [clearRestartArm, focusInput, restartArmed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      setCapsLockOn(e.getModifierState("CapsLock"));

      if (e.key === "Tab") {
        e.preventDefault();
        armRestart();
        return;
      }

      if (restartArmed && e.key === "Escape") {
        e.preventDefault();
        clearRestartArm();
        focusInput();
        return;
      }

      if (restartArmed && (e.key === " " || e.code === "Space")) {
        e.preventDefault();
        clearRestartArm();
        onRestart();
        return;
      }

      if (restartArmed) {
        e.preventDefault();
        clearRestartArm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }
      onKeyDown(e);
    },
    [armRestart, clearRestartArm, focusInput, onBack, onKeyDown, onRestart, restartArmed]
  );

  return (
    <div className="practice-root" onClick={handleTypingAreaClick}>
      <input
        ref={inputRef}
        className="practice-capture-input"
        onKeyDown={handleKeyDown}
        readOnly
        tabIndex={0}
        aria-hidden="true"
      />
      <div className="practice-bar">
        <button className="practice-bar__back" onClick={onBack}>
          lessons
        </button>
        <span className="practice-bar__title">
          lesson {lessonNumber} / <em>{lessonName.toLowerCase()}</em> / drill{" "}
          {typing.drillIndex + 1} of {typing.totalDrills}
        </span>
        <span className="practice-bar__progress">
          {Math.round(typing.progress * 100)}%
        </span>
      </div>
      <div className="practice-body">
        <div className="test-meta-row practice-meta-row" aria-live="polite">
          {!restartArmed && (
            <div className="test-restart-hint mono-label">
              tab to restart
            </div>
          )}
          {capsLockOn && <div className="test-caps-indicator mono-label">Caps Lock on</div>}
        </div>
        <div className="practice-cue-label mono-label">type what you see</div>
        <div className={`test-typing-stage practice-typing-stage${restartArmed ? " test-typing-stage--armed" : ""}`}>
          <div className="test-typing-wrap practice-typing-wrap">
            <TypingDisplay
              target={typing.target}
              typed={typing.typed}
              className="practice-text-display"
            />
          </div>
          {restartArmed && (
            <div className="test-restart-overlay" aria-live="polite" aria-label="Restart lesson confirmation">
              <div className="test-restart-overlay__icon" aria-hidden="true">↻</div>
              <div className="test-restart-overlay__body">
                <div>press space to restart</div>
                <div>click on the screen to resume</div>
              </div>
            </div>
          )}
        </div>
        <div className="practice-callout">
          {callout ? (
            <>
              <div className="practice-callout__key">
                {formatKeyLabel(callout.key)}
              </div>
              <div className="practice-callout__divider" />
              <div className="practice-callout__text">
                <div className="practice-callout__primary">
                  {callout.primaryInstruction ?? (
                    <>
                      Reach with your <strong>{callout.fingerName}</strong> — don't
                      move your whole hand
                    </>
                  )}
                </div>
                <div className="practice-callout__secondary">{callout.tip}</div>
              </div>
              <HandCue
                hand={callout.hand}
                activeFingerIndex={callout.fingerIndex}
              />
            </>
          ) : (
            <div className="practice-callout__placeholder">
              {typing.isFinished ? "Well done!" : "Keep typing..."}
            </div>
          )}
        </div>
        {settings?.showKeyboard !== false && (
          <div className="practice-keyboard-wrap">
            <Keyboard
              layoutType={settings?.keyboardLayout ?? "mac"}
              highlightKeys={guidedKeys}
              pressedKey={typing.pressedKey ?? ""}
              showFingerHints={settings?.showFingerHints !== false}
              mode="lesson"
            />
          </div>
        )}
      </div>
      <div className="practice-footer">
        <span className="practice-footer__hint">
          <kbd>esc</kbd> to exit
        </span>
        <span className="practice-footer__hint">
          <kbd>tab</kbd> restart
        </span>
        <button className="practice-footer__pause-btn" onClick={onBack}>
          exit
        </button>
      </div>
    </div>
  );
}

export default Home;
