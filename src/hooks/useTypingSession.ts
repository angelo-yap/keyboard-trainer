import { useRef, useEffect, useCallback, useState } from "react";
import { useTyping } from "./useTyping";
import type { TypingStats } from "./useTyping";
import type { SessionState } from "../core/session/sessionTypes";
import {
  createEmptyState,
  recordKeystroke,
  addWpmSample,
  endSession,
  getSessionMetrics,
} from "../core/session/sessionTracker";
import { createSessionRecorder } from "../core/session/sessionMetrics";
import type { SessionReport } from "../core/session/sessionMetrics";
import { sessionHistoryStore } from "../core/storage/sessionHistoryStore";
 
export type { SessionState } from "../core/session/sessionTypes";
export type { SessionMetrics } from "../core/session/sessionTypes";
export type { SessionReport } from "../core/session/sessionMetrics";
 
export type UseTypingSessionOptions = {
  text: string;
  enabled?: boolean;
  sessionType: "practice" | "test" | "drill";
  lessonId?: string;
  onComplete?: (stats: TypingStats, session: SessionState) => void;
  onProgress?: (progress: { nextChar: string; typedLength: number; totalLength: number }) => void;
};
 
/**
 * Typing hook with full session tracking for post-session analytics.
 * - Timer starts on first keystroke, continues even when paused
 * - WPM = (correctChars / 5) / minutesElapsed
 * - Accuracy = correctChars / totalTypedChars
 * - Collects keystrokes, wpmSamples (1/sec), letterStats
 * - Live stats are available but should be hidden/minimized during typing
 */
export function useTypingSession({
  text,
  enabled = true,
  sessionType,
  lessonId,
  onComplete,
  onProgress,
}: UseTypingSessionOptions) {
  const sessionRef = useRef<SessionState | null>(null);
  const lastCorrectTimeRef = useRef<number | null>(null);
  const wpmIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const recorderRef = useRef<ReturnType<typeof createSessionRecorder> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const [report, setReport] = useState<SessionReport | null>(null);
 
  const finishRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return null;
    recorderRef.current = null;
    clearInterval(tickIntervalRef.current);
    const r = rec.finish();
    sessionHistoryStore.save(r);
    setReport(r);
    return r;
  }, []);
 
  const handleKeystroke = useCallback(
    (event: {
      startedAt: number;
      time: number;
      expectedChar: string;
      typedChar: string;
      correct: boolean;
      index: number;
    }) => {
      if (!sessionRef.current) {
        sessionRef.current = createEmptyState(event.startedAt);
      }
      if (!recorderRef.current) {
        const prevBest = sessionHistoryStore.getPersonalBest();
        const prevAvg = sessionHistoryStore.getAverageWpm(20);
        recorderRef.current = createSessionRecorder({
          sessionType,
          lessonId,
          prevBestWpm: prevBest,
          prevAvgWpm: prevAvg,
        });
        tickIntervalRef.current = setInterval(() => recorderRef.current?.tick(), 3000);
      }
      recorderRef.current.recordKeypress({
        key: event.typedChar.toLowerCase(),
        expected: event.expectedChar.toLowerCase(),
        correct: event.correct,
      });
      const lastCorrect = lastCorrectTimeRef.current;
      sessionRef.current = recordKeystroke(
        sessionRef.current,
        {
          time: event.time,
          expectedChar: event.expectedChar,
          typedChar: event.typedChar,
          correct: event.correct,
          index: event.index,
        },
        lastCorrect
      );
      if (event.correct) {
        lastCorrectTimeRef.current = event.time;
      }
    },
    [sessionType, lessonId]
  );
 
  const handleComplete = useCallback(
    (stats: TypingStats) => {
      // If no onComplete handler, this is a timer-driven test — the timer
      // owns the session lifecycle. Don't finalize the recorder here or the
      // session will end the moment the text buffer runs out mid-test.
      if (!onComplete) return;
 
      finishRecorder();
      if (sessionRef.current) {
        const endedAt = Date.now();
        sessionRef.current = endSession(sessionRef.current, endedAt);
        onComplete(stats, sessionRef.current);
      } else {
        onComplete(stats, {
          ...createEmptyState(Date.now()),
          endedAt: Date.now(),
          elapsedMs: 0,
        });
      }
    },
    [onComplete, finishRecorder]
  );
 
  const typing = useTyping({
    text,
    enabled,
    onComplete: handleComplete,
    onProgress,
    onKeystroke: handleKeystroke,
  });
 
  // WPM samples every second while session is active
  useEffect(() => {
    if (!typing.startTime || typing.isComplete) {
      clearInterval(wpmIntervalRef.current);
      return;
    }
    wpmIntervalRef.current = setInterval(() => {
      if (sessionRef.current && !sessionRef.current.endedAt) {
        const now = Date.now();
        sessionRef.current = addWpmSample(sessionRef.current, now);
      }
    }, 1000);
    return () => clearInterval(wpmIntervalRef.current);
  }, [typing.startTime, typing.isComplete]);
 
  // Reset session state when text changes
  useEffect(() => {
    sessionRef.current = null;
    lastCorrectTimeRef.current = null;
    recorderRef.current = null;
    clearInterval(tickIntervalRef.current);
    setReport(null);
  }, [text]);
 
  const sessionMetrics =
    sessionRef.current && typing.startTime
      ? getSessionMetrics(sessionRef.current)
      : null;
 
  const liveWpm = recorderRef.current?.getliveWpm() ?? 0;
  const liveAccuracy = recorderRef.current?.getLiveAccuracy() ?? 100;
 
  const reset = useCallback(() => {
    sessionRef.current = null;
    lastCorrectTimeRef.current = null;
    recorderRef.current = null;
    clearInterval(tickIntervalRef.current);
    setReport(null);
    typing.reset();
  }, [typing]);
 
  /** End session early (e.g. for timed tests). Returns finalized session state. */
  const endSessionEarly = useCallback((): SessionState | null => {
    if (!sessionRef.current || sessionRef.current.endedAt) return null;
    finishRecorder();
    const endedAt = Date.now();
    sessionRef.current = endSession(sessionRef.current, endedAt);
    return sessionRef.current;
  }, [finishRecorder]);
 
  return {
    ...typing,
    reset,
    endSessionEarly,
    /** Session state (updated on each keystroke; full data on complete) */
    sessionState: sessionRef.current,
    /** Computed metrics using WPM/accuracy formulas */
    sessionMetrics,
    /** Report from reportcard when session finishes */
    report,
    /** Live WPM during session (from recorder) */
    liveWpm,
    /** Live accuracy during session (from recorder) */
    liveAccuracy,
  };
}