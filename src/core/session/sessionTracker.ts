import type {
  SessionState,
  KeystrokeEvent,
  WpmSample,
  LetterStatsEntry,
  SessionMetrics,
} from "./sessionTypes";

const WPM_FORMULA_CHARS_PER_WORD = 5;

/** Compute WPM: (correctCharacters / 5) / minutesElapsed */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60_000;
  return (correctChars / WPM_FORMULA_CHARS_PER_WORD) / minutes;
}

/** Compute accuracy: correctCharacters / totalTypedCharacters */
export function computeAccuracy(correctChars: number, totalChars: number): number {
  if (totalChars <= 0) return 100;
  return Math.round((correctChars / totalChars) * 100);
}

/** Derive final metrics from session state */
export function getSessionMetrics(state: SessionState): SessionMetrics {
  const elapsedMs = state.endedAt
    ? state.endedAt - state.startedAt
    : Math.max(0, Date.now() - state.startedAt);
  const minutes = elapsedMs / 60_000;

  const wpm = computeWpm(state.correctTypedChars, elapsedMs);
  const rawWpm = state.totalTypedChars > 0 && minutes > 0
    ? (state.totalTypedChars / WPM_FORMULA_CHARS_PER_WORD) / minutes
    : 0;

  return {
    wpm: Math.round(wpm),
    rawWpm: Math.round(rawWpm),
    accuracy: computeAccuracy(state.correctTypedChars, state.totalTypedChars),
    errors: state.incorrectTypedChars,
    chars: state.totalTypedChars,
    elapsedSeconds: elapsedMs / 1000,
  };
}

/** Create an empty session state */
export function createEmptyState(startedAt: number): SessionState {
  return {
    startedAt,
    endedAt: null,
    elapsedMs: 0,
    totalTypedChars: 0,
    correctTypedChars: 0,
    incorrectTypedChars: 0,
    keystrokes: [],
    wpmSamples: [],
    letterStats: {},
  };
}

/** Get or create letter stats entry */
function getLetterStats(
  letterStats: Record<string, LetterStatsEntry>,
  char: string
): LetterStatsEntry {
  const key = char.toLowerCase();
  if (!letterStats[key]) {
    letterStats[key] = { attempts: 0, correct: 0, mistakes: 0, totalLatencyMs: 0 };
  }
  return letterStats[key];
}

/** Record a keystroke and update session state. Returns updated state. */
export function recordKeystroke(
  state: SessionState,
  event: KeystrokeEvent,
  lastCorrectTimeMs: number | null
): SessionState {
  const keystrokes = [...state.keystrokes, event];
  const totalTypedChars = state.totalTypedChars + 1;
  const correctTypedChars = state.correctTypedChars + (event.correct ? 1 : 0);
  const incorrectTypedChars = state.incorrectTypedChars + (event.correct ? 0 : 1);

  const letterStats = { ...state.letterStats };
  const expectedKey = event.expectedChar.toLowerCase();
  const entry = getLetterStats(letterStats, expectedKey);
  letterStats[expectedKey] = {
    attempts: entry.attempts + 1,
    correct: entry.correct + (event.correct ? 1 : 0),
    mistakes: entry.mistakes + (event.correct ? 0 : 1),
    totalLatencyMs:
      entry.totalLatencyMs +
      (lastCorrectTimeMs != null ? event.time - lastCorrectTimeMs : 0),
  };

  return {
    ...state,
    keystrokes,
    totalTypedChars,
    correctTypedChars,
    incorrectTypedChars,
    letterStats,
  };
}

/** Add a WPM sample. Call once per second during the session. */
export function addWpmSample(state: SessionState, timeMs: number): SessionState {
  const elapsedMs = timeMs - state.startedAt;
  const wpm = computeWpm(state.correctTypedChars, elapsedMs);
  const sample: WpmSample = { time: elapsedMs, wpm };
  return {
    ...state,
    wpmSamples: [...state.wpmSamples, sample],
  };
}

/** End the session and finalize state */
export function endSession(state: SessionState, endedAt: number): SessionState {
  return {
    ...state,
    endedAt,
    elapsedMs: endedAt - state.startedAt,
  };
}
