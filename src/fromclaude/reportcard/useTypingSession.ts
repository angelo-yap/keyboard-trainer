/* ─── src/hooks/useTypingSession.ts ──────────────────────────────────────────
   Wraps your existing useTyping logic and adds session recording.

   This is meant to be a thin wrapper — it delegates all char/word logic
   to whatever useTyping already does and adds:
     - createSessionRecorder() lifecycle
     - setInterval tick every 3 s for WPM snapshots
     - Calls recorder.recordKeypress() on every char event
     - Returns the completed SessionReport when the session ends

   HOW TO INTEGRATE:
     Replace the direct useTyping() call in your Practice and Test routes
     with useTypingSession(). The returned API is a superset of useTyping.
   ──────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createSessionRecorder,
  type SessionRecorder,
  type SessionReport,
} from '../core/session/sessionMetrics';
import { sessionHistoryStore } from '../core/storage/sessionHistoryStore';

/* ── Config ───────────────────────────────────────────────────────────── */
const TICK_INTERVAL_MS = 3000;

/* ── Params ───────────────────────────────────────────────────────────── */
export interface UseTypingSessionParams {
  /** The full target string for this session */
  target: string;
  sessionType: SessionReport['sessionType'];
  lessonId?: string;
  /** Whether the session timer has started (first keypress or countdown) */
  autoStart?: boolean;
}

/* ── Return value ─────────────────────────────────────────────────────── */
export interface UseTypingSessionReturn {
  /* Live state (mirrors what your existing useTyping returns) */
  typed: string;
  liveWpm: number;
  liveAccuracy: number;
  isStarted: boolean;
  isFinished: boolean;

  /* Event handlers — wire these to your keyboard capture input */
  handleKeyDown: (e: KeyboardEvent | React.KeyboardEvent) => void;

  /* Completed report — non-null only after session ends */
  report: SessionReport | null;

  /* Manually end the session (e.g. user hits Esc to quit early) */
  finishEarly: () => void;

  /* Reset everything for a new session on the same target */
  reset: () => void;
}

/* ══════════════════════════════════════════════════════════════════════ */

export function useTypingSession({
  target,
  sessionType,
  lessonId,
}: UseTypingSessionParams): UseTypingSessionReturn {
  const [typed,        setTyped]        = useState('');
  const [isStarted,    setIsStarted]    = useState(false);
  const [isFinished,   setIsFinished]   = useState(false);
  const [report,       setReport]       = useState<SessionReport | null>(null);
  const [liveWpm,      setLiveWpm]      = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);

  const recorderRef = useRef<SessionRecorder | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Initialise recorder on mount / target change ─────────────────── */
  const initRecorder = useCallback(() => {
    recorderRef.current = createSessionRecorder({
      sessionType,
      lessonId,
      prevBestWpm:  sessionHistoryStore.getPersonalBest(),
      prevAvgWpm:   sessionHistoryStore.getAverageWpm(),
    });
  }, [sessionType, lessonId]);

  useEffect(() => {
    initRecorder();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [initRecorder]);

  /* ── Start tick when session begins ──────────────────────────────── */
  const startTick = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      recorderRef.current?.tick();
      setLiveWpm(recorderRef.current?.getliveWpm() ?? 0);
      setLiveAccuracy(recorderRef.current?.getLiveAccuracy() ?? 100);
    }, TICK_INTERVAL_MS);
  }, []);

  /* ── Finish session ───────────────────────────────────────────────── */
  const endSession = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec) return;

    const finalReport = rec.finish();
    sessionHistoryStore.save(finalReport);
    setReport(finalReport);
    setIsFinished(true);
    setLiveWpm(finalReport.wpm);
    setLiveAccuracy(finalReport.accuracy);
  }, []);

  const finishEarly = useCallback(() => {
    if (!isFinished) endSession();
  }, [isFinished, endSession]);

  /* ── Key handler ──────────────────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (isFinished) return;

      const key = e.key;

      /* Start the session on first printable keypress */
      if (!isStarted && key.length === 1) {
        setIsStarted(true);
        startTick();
      }

      if (!isStarted && key.length !== 1) return;

      /* Backspace */
      if (key === 'Backspace') {
        setTyped(prev => prev.slice(0, -1));
        return;
      }

      /* Tab = restart (don't record) */
      if (key === 'Tab') {
        e.preventDefault?.();
        return;
      }

      /* Only record printable characters */
      if (key.length !== 1) return;

      const position     = typed.length;
      const expectedChar = target[position] ?? '';
      const correct      = key === expectedChar;

      recorderRef.current?.recordKeypress({
        key,
        expected: expectedChar,
        correct,
      });

      setTyped(prev => {
        const next = prev + key;
        /* Auto-finish when target is fully typed */
        if (next.length >= target.length) {
          /* Use setTimeout to let state settle before finishing */
          setTimeout(endSession, 0);
        }
        return next;
      });
    },
    [isFinished, isStarted, typed, target, startTick, endSession],
  );

  /* ── Reset ────────────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setTyped('');
    setIsStarted(false);
    setIsFinished(false);
    setReport(null);
    setLiveWpm(0);
    setLiveAccuracy(100);
    initRecorder();
  }, [initRecorder]);

  return {
    typed,
    liveWpm,
    liveAccuracy,
    isStarted,
    isFinished,
    handleKeyDown,
    report,
    finishEarly,
    reset,
  };
}
