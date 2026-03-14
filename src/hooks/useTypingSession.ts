import { useRef, useEffect, useCallback } from "react";
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

export type { SessionState } from "../core/session/sessionTypes";
export type { SessionMetrics } from "../core/session/sessionTypes";

export type UseTypingSessionOptions = {
  text: string;
  enabled?: boolean;
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
  onComplete,
  onProgress,
}: UseTypingSessionOptions) {
  const sessionRef = useRef<SessionState | null>(null);
  const lastCorrectTimeRef = useRef<number | null>(null);
  const wpmIntervalRef = useRef<ReturnType<typeof setInterval>>();

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
    []
  );

  const handleComplete = useCallback(
    (stats: TypingStats) => {
      if (sessionRef.current) {
        const endedAt = Date.now();
        sessionRef.current = endSession(sessionRef.current, endedAt);
        onComplete?.(stats, sessionRef.current);
      } else {
        onComplete?.(stats, {
          ...createEmptyState(Date.now()),
          endedAt: Date.now(),
          elapsedMs: 0,
        });
      }
    },
    [onComplete]
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
  }, [text]);

  const sessionMetrics =
    sessionRef.current && typing.startTime
      ? getSessionMetrics(sessionRef.current)
      : null;

  const reset = useCallback(() => {
    sessionRef.current = null;
    lastCorrectTimeRef.current = null;
    typing.reset();
  }, [typing]);

  /** End session early (e.g. for timed tests). Returns finalized session state. */
  const endSessionEarly = useCallback((): SessionState | null => {
    if (!sessionRef.current || sessionRef.current.endedAt) return null;
    const endedAt = Date.now();
    sessionRef.current = endSession(sessionRef.current, endedAt);
    return sessionRef.current;
  }, []);

  return {
    ...typing,
    reset,
    endSessionEarly,
    /** Session state (updated on each keystroke; full data on complete) */
    sessionState: sessionRef.current,
    /** Computed metrics using WPM/accuracy formulas */
    sessionMetrics,
  };
}
