/** Keystroke event recorded during a typing session */
export type KeystrokeEvent = {
  time: number; // ms since session start
  expectedChar: string;
  typedChar: string;
  correct: boolean;
  index: number;
};

/** WPM sample collected once per second during the session */
export type WpmSample = {
  time: number; // ms since session start
  wpm: number;
};

/** Per-character statistics for letter analytics */
export type LetterStatsEntry = {
  attempts: number;
  correct: number;
  mistakes: number;
  totalLatencyMs: number;
};

/** Full session state for analytics */
export type SessionState = {
  startedAt: number;
  endedAt: number | null;
  elapsedMs: number;
  totalTypedChars: number;
  correctTypedChars: number;
  incorrectTypedChars: number;
  keystrokes: KeystrokeEvent[];
  wpmSamples: WpmSample[];
  letterStats: Record<string, LetterStatsEntry>;
};

/** Computed final metrics from a completed session */
export type SessionMetrics = {
  wpm: number; // (correctChars / 5) / minutesElapsed
  accuracy: number; // correctChars / totalTypedChars
  rawWpm: number; // totalChars / 5 / minutesElapsed
  errors: number;
  chars: number;
  elapsedSeconds: number;
};
