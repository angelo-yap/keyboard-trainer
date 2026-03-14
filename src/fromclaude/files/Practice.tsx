/* ─── src/routes/Practice.tsx ────────────────────────────────────────────────
   The core practice session view. Connects to useTyping and your lesson data.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useCallback } from 'react';
import './Practice.css';
import { TypingDisplay } from '../ui/components/TypingDisplay';

/* ── Types ────────────────────────────────────────────────────────────── */

interface FingerCallout {
  key: string;
  fingerName: string;         /* e.g. "right pinky" */
  hand: 'left' | 'right';
  fingerIndex: number;        /* 0 = pinky, 4 = index — for highlighting */
  tip: string;                /* coaching sentence */
}

/** Mirror your useTyping hook's shape — adapt field names as needed */
interface TypingState {
  target: string;
  typed: string;
  wpm: number;
  accuracy: number;
  timeLeft: number;           /* seconds */
  drillIndex: number;
  totalDrills: number;
  isFinished: boolean;
}

interface PracticeProps {
  lessonNumber: number;
  lessonName: string;
  typing: TypingState;
  callout: FingerCallout | null;
  /** Per-key accuracy in this session, e.g. { p: 62, w: 88, o: 95 } */
  sessionKeyAccuracy: Record<string, number>;
  /** Accuracy history for the thin strip — true = hit, false = miss, null = upcoming */
  accuracyHistory: (boolean | null)[];
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBack: () => void;
  onRestart: () => void;
  onPause: () => void;
}

/* ── Finger hand cue ──────────────────────────────────────────────────── */

const FINGER_KEYS_LEFT  = ['a', 's', 'd', 'f', ''];   /* L5→L1 (thumb blank) */
const FINGER_KEYS_RIGHT = ['', 'j', 'k', 'l', ';'];   /* R1(thumb)→R5 */

const HandCue: React.FC<{
  hand: 'left' | 'right';
  activeFingerIndex: number;
}> = ({ hand, activeFingerIndex }) => {
  /* 5 fingers: index 0 = pinky, 4 = index/thumb side */
  const keys   = hand === 'left' ? FINGER_KEYS_LEFT  : FINGER_KEYS_RIGHT;
  const heights = [44, 52, 56, 62, 20];   /* pinky → index → thumb */

  return (
    <div className="practice-hand-cue">
      {keys.map((k, i) => {
        const isThumb  = i === 4;
        const isActive = i === activeFingerIndex;

        if (isThumb) {
          return (
            <div
              key="thumb"
              className={`practice-hc-thumb practice-hc-thumb--${hand}`}
            />
          );
        }

        return (
          <div key={i} className="practice-hc-finger-col">
            <div
              className={`practice-hc-finger${isActive ? ' practice-hc-finger--active' : ''}`}
              style={{ height: heights[i] }}
            >
              {k}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Accuracy strip ───────────────────────────────────────────────────── */

const AccuracyStrip: React.FC<{
  history: (boolean | null)[];
}> = ({ history }) => (
  <div className="practice-acc-strip" aria-hidden="true">
    {history.map((hit, i) => (
      <div
        key={i}
        className={[
          'practice-acc-seg',
          hit === true  ? 'practice-acc-seg--hit'    : '',
          hit === false ? 'practice-acc-seg--miss'   : '',
          hit === null  ? 'practice-acc-seg--upcoming' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    ))}
  </div>
);

/* ── Key accuracy list (sidebar) ──────────────────────────────────────── */

const KeyAccuracyList: React.FC<{
  sessionKeyAccuracy: Record<string, number>;
}> = ({ sessionKeyAccuracy }) => {
  const entries = Object.entries(sessionKeyAccuracy).sort(([, a], [, b]) => a - b);

  if (entries.length === 0) return null;

  return (
    <div className="practice-key-acc">
      <div className="mono-label practice-section-label">this session</div>
      {entries.slice(0, 5).map(([key, acc]) => (
        <div key={key} className="practice-key-acc-row">
          <span className="practice-key-acc-row__key">{key}</span>
          <div className="practice-key-acc-row__track">
            <div
              className={`practice-key-acc-row__fill${acc < 80 ? ' practice-key-acc-row__fill--weak' : ''}`}
              style={{ width: `${acc}%` }}
            />
          </div>
          <span className="practice-key-acc-row__pct">{acc}%</span>
        </div>
      ))}
    </div>
  );
};

/* ── Main component ───────────────────────────────────────────────────── */

export const Practice: React.FC<PracticeProps> = ({
  lessonNumber,
  lessonName,
  typing,
  callout,
  sessionKeyAccuracy,
  accuracyHistory,
  onKeyDown,
  onBack,
  onRestart,
  onPause,
}) => {
  /* Hidden input captures keystrokes in Electron where focus is predictable */
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const wpmColor =
    typing.wpm >= 50 ? 'ok'   :
    typing.wpm >= 30 ? ''     :
    'warn';

  const accColor =
    typing.accuracy >= 95 ? 'ok'   :
    typing.accuracy >= 85 ? ''     :
    'warn';

  const minutes  = Math.floor(typing.timeLeft / 60);
  const seconds  = String(typing.timeLeft % 60).padStart(2, '0');
  const timeStr  = `${minutes}:${seconds}`;

  return (
    <div className="practice-root" onClick={focusInput}>
      {/* Hidden capture input */}
      <input
        ref={inputRef}
        className="practice-capture-input"
        onKeyDown={onKeyDown}
        readOnly
        tabIndex={0}
        aria-hidden="true"
      />

      {/* ── Session bar ─────────────────────────────────────────────── */}
      <div className="practice-bar">
        <button className="practice-bar__back" onClick={onBack}>
          ← lessons
        </button>
        <span className="practice-bar__title">
          lesson {lessonNumber}&nbsp;/&nbsp;
          <em>{lessonName.toLowerCase()}</em>
          &nbsp;/&nbsp;
          drill {typing.drillIndex + 1} of {typing.totalDrills}
        </span>
        <div className="practice-bar__metrics">
          <span className={`practice-live-metric${wpmColor ? ` practice-live-metric--${wpmColor}` : ''}`}>
            <strong>{typing.wpm}</strong> wpm
          </span>
          <span className={`practice-live-metric${accColor ? ` practice-live-metric--${accColor}` : ''}`}>
            <strong>{typing.accuracy}</strong>% acc
          </span>
          <span className="practice-live-metric">
            <strong>{timeStr}</strong> left
          </span>
        </div>
      </div>

      {/* ── Accuracy strip ──────────────────────────────────────────── */}
      <AccuracyStrip history={accuracyHistory} />

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="practice-body">
        {/* Cue label */}
        <div className="practice-cue-label mono-label">type what you see</div>

        {/* Text display */}
        <TypingDisplay
          target={typing.target}
          typed={typing.typed}
          className="practice-text-display"
        />

        {/* Finger callout */}
        {callout && (
          <div className="practice-callout">
            <div className="practice-callout__key">{callout.key}</div>
            <div className="practice-callout__divider" />
            <div className="practice-callout__text">
              <div className="practice-callout__primary">
                Reach with your{' '}
                <strong>{callout.fingerName}</strong>
                {' '}— don't move your whole hand
              </div>
              <div className="practice-callout__secondary">{callout.tip}</div>
            </div>
            <HandCue
              hand={callout.hand}
              activeFingerIndex={callout.fingerIndex}
            />
          </div>
        )}

        {/* Key accuracy (visible once user starts typing) */}
        {Object.keys(sessionKeyAccuracy).length > 0 && (
          <KeyAccuracyList sessionKeyAccuracy={sessionKeyAccuracy} />
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="practice-footer">
        <span className="practice-footer__hint">
          <kbd>esc</kbd> to pause
        </span>
        <span className="practice-footer__hint">
          <kbd>tab</kbd> restart line
        </span>
        <span className="practice-footer__hint">
          <kbd>ctrl+,</kbd> settings
        </span>
        <button className="practice-footer__pause-btn" onClick={onPause}>
          pause
        </button>
      </div>
    </div>
  );
};

export default Practice;
