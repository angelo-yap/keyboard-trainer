/* ─── src/routes/Learn.tsx ───────────────────────────────────────────────────
   Drives the interactive learn curriculum defined in learnSteps.ts.

   Key behaviours:
   - "Continue" is locked until the current step's drill is satisfied.
   - Drill completion state is tracked locally; the route emits
     onBack() when the user exits or completes the curriculum.
   - Progress is saved to progressStore so the user can resume mid-curriculum.
   ──────────────────────────────────────────────────────────────────────── */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import "../ui/Layout/LessonStage.css";
import "./Learn.css";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { Keyboard } from "../ui/components/keyboard";
import type { Settings } from "../core/storage/settingsStore";
import {
  LEARN_STEPS,
  TOTAL_STEPS,
  isLastStep,
  type LearnStep,
} from "../core/lesson/learnSteps";
import { getLearnProgress, saveLearnProgress } from "../core/storage/progressStore";
import { resetKeyboardLed, sendKeyboardLedForKeys } from "../core/keyboard/keyboardLedBridge";
import { getGuidanceKeysForChar } from "../core/keyboard/keyNormalization";

/* ── Props ────────────────────────────────────────────────────────────── */

interface LearnProps {
  /** Called when user returns to home (back from step 0 or skip to practice) */
  onBack: () => void;
  /** Called when user completes the final step (curriculum complete). If not provided, onBack is used. */
  onCurriculumComplete?: () => void;
  settings?: Settings;
}

/* ── Drill state machine ──────────────────────────────────────────────── */

interface DrillState {
  typed: string;
  keyHits: Record<string, number>;
  repsCompleted: number;
  isComplete: boolean;
}

function makeFreshDrillState(): DrillState {
  return { typed: "", keyHits: {}, repsCompleted: 0, isComplete: false };
}

/* ── Drill logic ─────────────────────────────────────────────────────── */

function evaluateDrill(step: LearnStep, state: DrillState): boolean {
  const { drill } = step;

  if (drill.type === "none") return true;

  if (drill.type === "hold") return true;

  const required = drill.requiredReps ?? 1;

  if (drill.type === "keys") {
    const keys = drill.keys ?? [];
    return keys.every((k) => (state.keyHits[k] ?? 0) >= required);
  }

  if (drill.type === "sequence") {
    return state.repsCompleted >= required;
  }

  return false;
}

/* ── Step progress dots ──────────────────────────────────────────────── */

const StepDots: React.FC<{ current: number; total: number }> = ({
  current,
  total,
}) => (
  <div
    className="learn-step-dots"
    aria-label={`Step ${current + 1} of ${total}`}
  >
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={[
          "learn-step-dot",
          i < current ? "learn-step-dot--done" : "",
          i === current ? "learn-step-dot--current" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    ))}
  </div>
);

/* ── Body renderer ───────────────────────────────────────────────────── */

/** Converts **bold** markers to <strong> elements */
function renderBody(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export function Learn({ onBack, onCurriculumComplete, settings }: LearnProps) {
  const [stepIndex, setStepIndex] = useState(() =>
    Math.min(getLearnProgress(), TOTAL_STEPS - 1),
  );
  const [drill, setDrill] = useState<DrillState>(makeFreshDrillState());
  const [lastKey, setLastKey] = useState<string>("");
  const lastGuidedKeyRef = useRef<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const step = LEARN_STEPS[stepIndex];
  const drillDone = useMemo(() => evaluateDrill(step, drill), [step, drill]);

  /* Focus input whenever step changes */
  useEffect(() => {
    setDrill(makeFreshDrillState());
    setLastKey("");
    lastGuidedKeyRef.current = null;
    if (step.drill.type !== "none") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [stepIndex]);

  const guidedTargetKeys = useMemo(() => {
    if (step.drill.type === "keys") {
      const keys = step.drill.keys ?? [];
      const required = step.drill.requiredReps ?? 1;
      const nextPending = keys.find((k) => (drill.keyHits[k] ?? 0) < required) ?? keys[0] ?? "";
      return getGuidanceKeysForChar(nextPending);
    }

    if (step.drill.type === "sequence") {
      const sequence = step.drill.sequence ?? "";
      const nextChar = sequence.charAt(drill.typed.length);
      return getGuidanceKeysForChar(nextChar);
    }

    return [];
  }, [step, drill]);

  const guidedKeySignature = guidedTargetKeys.join("+");

  useEffect(() => {
    if (step.drill.type === "none" || step.drill.type === "hold") {
      lastGuidedKeyRef.current = null;
      void resetKeyboardLed();
      return;
    }

    if (guidedTargetKeys.length === 0 || guidedKeySignature === lastGuidedKeyRef.current) {
      return;
    }

    lastGuidedKeyRef.current = guidedKeySignature;
    void sendKeyboardLedForKeys(guidedTargetKeys);
  }, [step.drill.type, guidedTargetKeys, guidedKeySignature]);

  useEffect(() => {
    return () => {
      void resetKeyboardLed();
    };
  }, []);

  /* ── Navigation ────────────────────────────────────────────────────── */
  const handleContinue = useCallback(() => {
    if (!drillDone) return;
    saveLearnProgress(stepIndex + 1);

    if (isLastStep(step.id)) {
      (onCurriculumComplete ?? onBack)();
      return;
    }

    setStepIndex((i) => i + 1);
    inputRef.current?.focus();
  }, [drillDone, stepIndex, step, onBack, onCurriculumComplete]);

  /* Enter to advance — document listener so it works even when input not focused */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!drillDone) return;
      e.preventDefault();
      handleContinue();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drillDone, handleContinue]);

  /* ── Key handler ───────────────────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (step.drill.type === "none" || step.drill.type === "hold") return;

      const key = e.key === " " ? " " : e.key.toLowerCase();
      setLastKey(key);

      if (step.drill.type === "keys") {
        const validKeys = step.drill.keys ?? [];
        if (validKeys.includes(key)) {
          setDrill((prev) => ({
            ...prev,
            keyHits: {
              ...prev.keyHits,
              [key]: (prev.keyHits[key] ?? 0) + 1,
            },
          }));
        }
        e.preventDefault();
        return;
      }

      if (step.drill.type === "sequence") {
        const seq = step.drill.sequence ?? "";
        e.preventDefault();

        if (e.key === "Backspace") {
          setDrill((prev) => ({
            ...prev,
            typed: prev.typed.slice(0, -1),
          }));
          return;
        }

        if (e.key === "Tab") return;

        const printable = e.key.length === 1;
        if (!printable) return;

        setDrill((prev) => {
          const next = prev.typed + (e.key === " " ? " " : e.key);

          if (next === seq) {
            const reps = prev.repsCompleted + 1;
            const required = step.drill.requiredReps ?? 1;
            return {
              ...prev,
              typed: "",
              repsCompleted: reps,
              isComplete: reps >= required,
            };
          }

          if (next.length > seq.length) {
            return { ...prev, typed: "" };
          }

          return { ...prev, typed: next };
        });
      }
    },
    [step],
  );

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      onBack();
      return;
    }
    setStepIndex((i) => i - 1);
  }, [stepIndex, onBack]);

  const keysDrillKeys =
    step.drill.type === "keys" ? step.drill.keys ?? [] : [];
  const required = step.drill.requiredReps ?? 1;

  const paragraphs = step.body
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="lesson-stage-root lesson-stage-root--with-footer learn-root">
      <div className="lesson-stage-topbar learn-topbar">
        <button
          className="lesson-stage-topbar__back"
          onClick={handleBack}
        >
          ← back
        </button>
        <StepDots current={stepIndex} total={TOTAL_STEPS} />
        <span className="learn-topbar__label mono-label">
          {stepIndex + 1} / {TOTAL_STEPS}
        </span>
      </div>

      <div
        className={`learn-body${step.splitLayout ? " learn-body--split" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className="learn-capture-input"
          onKeyDown={handleKeyDown}
          readOnly
          tabIndex={0}
        />

        <div className="learn-concept">
          <div className="learn-concept__eyebrow mono-label">{step.eyebrow}</div>
          <h2 className="learn-concept__title">{step.title}</h2>
          <div className="learn-concept__body">
            {paragraphs.map((para, i) => (
              <p key={i}>{renderBody(para)}</p>
            ))}
          </div>
        </div>

        <div className="learn-drill-col">
          {settings?.showKeyboard !== false && (
            <div className="lesson-stage-keyboard-wrap">
              <Keyboard
                layoutType={settings?.keyboardLayout ?? "mac"}
                highlightKeys={[...step.highlight, ...guidedTargetKeys]}
                pressedKey={lastKey}
                showFingerHints={settings?.showFingerHints !== false}
                mode="lesson"
              />
            </div>
          )}

          <div className="learn-drill">
            {step.drill.type === "keys" && (
              <div className="learn-drill__keys">
                {keysDrillKeys.map((k) => {
                  const hits = drill.keyHits[k] ?? 0;
                  const done = hits >= required;
                  return (
                    <div
                      key={k}
                      className={`learn-drill__key-target${done ? " learn-drill__key-target--done" : ""}`}
                    >
                      <span className="learn-drill__key-target-key">{k}</span>
                      <div className="learn-drill__key-pips">
                        {Array.from({ length: required }, (_, i) => (
                          <div
                            key={i}
                            className={`learn-drill__key-pip${i < hits ? " learn-drill__key-pip--filled" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {step.drill.type === "sequence" && (
              <div className="learn-drill__sequence">
                <TypingDisplay
                  target={step.drill.sequence ?? ""}
                  typed={drill.typed}
                  showCursor={true}
                  className="learn-typing-display"
                />
                {(step.drill.requiredReps ?? 1) > 1 && (
                  <div className="learn-drill__rep-count">
                    {drill.repsCompleted} / {step.drill.requiredReps} complete
                  </div>
                )}
              </div>
            )}

            {step.drill.hint && (
              <div className="learn-drill__hint mono-label">
                {step.drill.hint}
              </div>
            )}

            {drillDone && step.drill.type !== "none" && (
              <div className="learn-drill__complete">ready to continue</div>
            )}
          </div>
        </div>
      </div>

      <div className="learn-footer">
        <button className="learn-footer__skip" onClick={onBack}>
          skip to practice
        </button>
        <button
          className={`learn-footer__continue${drillDone ? " learn-footer__continue--ready" : ""}`}
          onClick={handleContinue}
          disabled={!drillDone}
        >
          {isLastStep(step.id) ? "start practising →" : "continue →"}
        </button>
      </div>
    </div>
  );
}
