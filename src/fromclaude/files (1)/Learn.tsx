/* ─── src/routes/Learn.tsx ───────────────────────────────────────────────────
   Drives the interactive learn curriculum defined in learnSteps.ts.

   Key behaviours:
   - "Continue" is locked until the current step's drill is satisfied.
   - Drill completion state is tracked locally; the route emits
     onLessonComplete() when the final step is done.
   - Progress is saved to progressStore so the user can resume mid-curriculum.
   ──────────────────────────────────────────────────────────────────────── */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import './Learn.css';
import { TypingDisplay } from '../ui/components/TypingDisplay';
import {
  LEARN_STEPS,
  TOTAL_STEPS,
  isLastStep,
  type LearnStep,
} from '../core/lesson/learnSteps';

/* ── Props ────────────────────────────────────────────────────────────── */

interface LearnProps {
  /** Index of the step to start on (from progressStore) */
  initialStepIndex?: number;
  /** Called when the user saves progress mid-curriculum */
  onSaveProgress?: (stepIndex: number) => void;
  /** Called when the last step's drill is completed */
  onCurriculumComplete?: () => void;
  /** Lets the user jump to Practice */
  onGoToPractice?: () => void;
}

/* ── Drill state machine ──────────────────────────────────────────────── */

interface DrillState {
  typed: string;                    /* current input value */
  keyHits: Record<string, number>;  /* for 'keys' drill */
  repsCompleted: number;
  isComplete: boolean;
}

function makeFreshDrillState(): DrillState {
  return { typed: '', keyHits: {}, repsCompleted: 0, isComplete: false };
}

/* ── Drill logic ─────────────────────────────────────────────────────── */

function evaluateDrill(step: LearnStep, state: DrillState): boolean {
  const { drill } = step;

  if (drill.type === 'none') return true;

  if (drill.type === 'hold') return true; /* handled by confirm button */

  const required = drill.requiredReps ?? 1;

  if (drill.type === 'keys') {
    const keys = drill.keys ?? [];
    return keys.every(k => (state.keyHits[k] ?? 0) >= required);
  }

  if (drill.type === 'sequence') {
    return state.repsCompleted >= required;
  }

  return false;
}

/* ── Mini keyboard visual ────────────────────────────────────────────── */

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l',';'],
  ['z','x','c','v','b','n','m',',','.'],
];

const MiniKeyboard: React.FC<{
  highlight: string[];
  activeKey?: string;
}> = ({ highlight, activeKey }) => (
  <div className="learn-keyboard" aria-hidden="true">
    {ROWS.map((row, ri) => (
      <div key={ri} className="learn-keyboard__row">
        {row.map(key => {
          const isHighlighted = highlight.includes(key);
          const isActive      = activeKey === key;
          return (
            <div
              key={key}
              className={[
                'learn-keyboard__key',
                isHighlighted ? 'learn-keyboard__key--highlighted' : '',
                isActive      ? 'learn-keyboard__key--active'      : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {key}
            </div>
          );
        })}
      </div>
    ))}
    {/* Space bar row */}
    <div className="learn-keyboard__row">
      <div
        className={[
          'learn-keyboard__key learn-keyboard__key--space',
          highlight.includes(' ') ? 'learn-keyboard__key--highlighted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        space
      </div>
    </div>
  </div>
);

/* ── Step progress dots ──────────────────────────────────────────────── */

const StepDots: React.FC<{ current: number; total: number }> = ({
  current,
  total,
}) => (
  <div className="learn-step-dots" aria-label={`Step ${current + 1} of ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={[
          'learn-step-dot',
          i < current  ? 'learn-step-dot--done'    : '',
          i === current ? 'learn-step-dot--current' : '',
        ]
          .filter(Boolean)
          .join(' ')}
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

export const Learn: React.FC<LearnProps> = ({
  initialStepIndex = 0,
  onSaveProgress,
  onCurriculumComplete,
  onGoToPractice,
}) => {
  const [stepIndex, setStepIndex]   = useState(initialStepIndex);
  const [drill, setDrill]           = useState<DrillState>(makeFreshDrillState());
  const [lastKey, setLastKey]       = useState<string>('');

  const inputRef  = useRef<HTMLInputElement>(null);
  const step      = LEARN_STEPS[stepIndex];
  const drillDone = useMemo(() => evaluateDrill(step, drill), [step, drill]);

  /* Focus input whenever step changes */
  useEffect(() => {
    setDrill(makeFreshDrillState());
    setLastKey('');
    if (step.drill.type !== 'none') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [stepIndex]);

  /* ── Key handler ───────────────────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (step.drill.type === 'none' || step.drill.type === 'hold') return;

      const key = e.key === ' ' ? ' ' : e.key.toLowerCase();
      setLastKey(key);

      /* ── 'keys' drill ──────────────────────────────────────────────── */
      if (step.drill.type === 'keys') {
        const validKeys = step.drill.keys ?? [];
        if (validKeys.includes(key)) {
          setDrill(prev => ({
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

      /* ── 'sequence' drill ──────────────────────────────────────────── */
      if (step.drill.type === 'sequence') {
        const seq = step.drill.sequence ?? '';
        e.preventDefault();

        if (e.key === 'Backspace') {
          setDrill(prev => ({
            ...prev,
            typed: prev.typed.slice(0, -1),
          }));
          return;
        }

        if (e.key === 'Tab') return; /* don't capture tab */

        const printable = e.key.length === 1;
        if (!printable) return;

        setDrill(prev => {
          const next = prev.typed + (e.key === ' ' ? ' ' : e.key);

          /* Rep completed */
          if (next === seq) {
            const reps = prev.repsCompleted + 1;
            const required = step.drill.requiredReps ?? 1;
            return {
              ...prev,
              typed: '',
              repsCompleted: reps,
              isComplete: reps >= required,
            };
          }

          /* Overshot — reset typed */
          if (next.length > seq.length) {
            return { ...prev, typed: '' };
          }

          return { ...prev, typed: next };
        });
      }
    },
    [step],
  );

  /* ── Navigation ────────────────────────────────────────────────────── */
  const handleContinue = useCallback(() => {
    if (!drillDone) return;
    onSaveProgress?.(stepIndex + 1);

    if (isLastStep(step.id)) {
      onCurriculumComplete?.();
      return;
    }

    setStepIndex(i => i + 1);
    inputRef.current?.focus();
  }, [drillDone, stepIndex, step, onSaveProgress, onCurriculumComplete]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) return;
    setStepIndex(i => i - 1);
  }, [stepIndex]);

  /* ── Keys drill progress display ───────────────────────────────────── */
  const keysDrillKeys = step.drill.type === 'keys' ? (step.drill.keys ?? []) : [];
  const required = step.drill.requiredReps ?? 1;

  /* Paragraphs from body */
  const paragraphs = step.body
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div className="learn-root">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="learn-topbar">
        <button
          className="learn-topbar__back"
          onClick={handleBack}
          disabled={stepIndex === 0}
        >
          ← back
        </button>
        <StepDots current={stepIndex} total={TOTAL_STEPS} />
        <span className="learn-topbar__label mono-label">
          {stepIndex + 1} / {TOTAL_STEPS}
        </span>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div
        className={`learn-body${step.splitLayout ? ' learn-body--split' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Capture input — always present */}
        <input
          ref={inputRef}
          className="learn-capture-input"
          onKeyDown={handleKeyDown}
          readOnly
          tabIndex={0}
        />

        {/* ── Left / main column — concept ──────────────────────── */}
        <div className="learn-concept">
          <div className="learn-concept__eyebrow mono-label">{step.eyebrow}</div>
          <h2 className="learn-concept__title">{step.title}</h2>
          <div className="learn-concept__body">
            {paragraphs.map((para, i) => (
              <p key={i}>{renderBody(para)}</p>
            ))}
          </div>
        </div>

        {/* ── Right column — keyboard + drill ───────────────────── */}
        <div className="learn-drill-col">
          {step.highlight.length > 0 && (
            <MiniKeyboard highlight={step.highlight} activeKey={lastKey} />
          )}

          {/* ── Drill area ─────────────────────────────────────── */}
          <div className="learn-drill">
            {/* 'keys' drill */}
            {step.drill.type === 'keys' && (
              <div className="learn-drill__keys">
                {keysDrillKeys.map(k => {
                  const hits = drill.keyHits[k] ?? 0;
                  const done = hits >= required;
                  return (
                    <div
                      key={k}
                      className={`learn-drill__key-target${done ? ' learn-drill__key-target--done' : ''}`}
                    >
                      <span className="learn-drill__key-target-key">{k}</span>
                      <div className="learn-drill__key-pips">
                        {Array.from({ length: required }, (_, i) => (
                          <div
                            key={i}
                            className={`learn-drill__key-pip${i < hits ? ' learn-drill__key-pip--filled' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 'sequence' drill */}
            {step.drill.type === 'sequence' && (
              <div className="learn-drill__sequence">
                <TypingDisplay
                  target={step.drill.sequence ?? ''}
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

            {/* Hint */}
            {step.drill.hint && (
              <div className="learn-drill__hint mono-label">
                {step.drill.hint}
              </div>
            )}

            {/* Completion flash */}
            {drillDone && step.drill.type !== 'none' && (
              <div className="learn-drill__complete">
                ready to continue
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="learn-footer">
        {onGoToPractice && (
          <button className="learn-footer__skip" onClick={onGoToPractice}>
            skip to practice
          </button>
        )}
        <button
          className={`learn-footer__continue${drillDone ? ' learn-footer__continue--ready' : ''}`}
          onClick={handleContinue}
          disabled={!drillDone}
        >
          {isLastStep(step.id) ? 'start practising →' : 'continue →'}
        </button>
      </div>
    </div>
  );
};

export default Learn;
