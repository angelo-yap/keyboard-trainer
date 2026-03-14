/* ─── src/core/session/sessionMetrics.ts ─────────────────────────────────────
   Everything needed to capture, compute, and persist a typing session report.

   USAGE FLOW:
     1. Call createSessionRecorder() when a session starts.
     2. Call recorder.recordKeypress(...) on every keydown.
     3. Call recorder.tick() on a setInterval (every 3 s) to snapshot WPM.
     4. Call recorder.finish() when the session ends → returns SessionReport.
     5. Persist the report via sessionHistoryStore.save(report).
   ──────────────────────────────────────────────────────────────────────── */

/* ── Raw event captured on every keypress ────────────────────────────── */
export interface KeyEvent {
  key: string;          /* single character, lowercased. space = ' ' */
  expected: string;     /* what the target string expected at this position */
  correct: boolean;
  timestamp: number;    /* performance.now() */
}

/* ── Snapshot taken every N seconds during the session ───────────────── */
export interface WpmSnapshot {
  elapsedSeconds: number;
  wpm: number;
}

/* ── Final computed report ───────────────────────────────────────────── */
export interface KeyStat {
  key: string;
  attempts: number;
  correct: number;
  accuracy: number;           /* 0–100, rounded */
  avgReactionMs: number;      /* avg ms between previous keypress and this key */
}

export interface SessionReport {
  id: string;                 /* crypto.randomUUID() */
  sessionType: 'practice' | 'test' | 'drill';
  lessonId?: string;          /* set for practice/drill sessions */
  startedAt: number;          /* Date.now() at session start */
  durationSeconds: number;

  /* ── Core numbers ───────────────────────────────────────────────── */
  wpm: number;                /* final WPM (correct chars / 5 / minutes) */
  rawWpm: number;             /* all chars typed / 5 / minutes (no error penalty) */
  accuracy: number;           /* 0–100 */
  correctChars: number;
  errorChars: number;
  totalChars: number;
  consistency: number;        /* 0–100: 100 = perfectly even speed */

  /* ── Trend ──────────────────────────────────────────────────────── */
  wpmSnapshots: WpmSnapshot[];  /* sampled every ~3 s during session */

  /* ── Per-key breakdown ──────────────────────────────────────────── */
  keyStats: KeyStat[];          /* sorted by accuracy asc (worst first) */
  strongKeys: string[];         /* accuracy >= 95%, attempts >= 3 */
  weakKeys: string[];           /* accuracy < 80%, attempts >= 3 */
  slowKeys: string[];           /* avgReactionMs in top 20% (slowest), attempts >= 3 */

  /* ── Comparison to personal bests (populated by sessionHistoryStore) */
  prevBestWpm?: number;
  prevAvgWpm?: number;
  isPersonalBest: boolean;
}

/* ── Recorder object returned by createSessionRecorder() ─────────────── */
export interface SessionRecorder {
  recordKeypress: (params: {
    key: string;
    expected: string;
    correct: boolean;
  }) => void;
  tick: () => void;             /* call every 3 s on a setInterval */
  finish: () => SessionReport;
  getliveWpm: () => number;     /* for the topbar display during session */
  getLiveAccuracy: () => number;
}

/* ══════════════════════════════════════════════════════════════════════ */

const CHARS_PER_WORD = 5;
const SNAPSHOT_INTERVAL_S = 3;

function roundTo(n: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  /* Fallback for older Electron contexts */
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ── Main factory ─────────────────────────────────────────────────────── */
export function createSessionRecorder(params: {
  sessionType: SessionReport['sessionType'];
  lessonId?: string;
  prevBestWpm?: number;
  prevAvgWpm?: number;
}): SessionRecorder {
  const startedAt      = Date.now();
  const startPerf      = performance.now();
  const events: KeyEvent[]          = [];
  const snapshots: WpmSnapshot[]    = [];
  let   lastKeypressTime = startPerf; /* for reaction-time deltas */

  /* ── recordKeypress ─────────────────────────────────────────────── */
  function recordKeypress({
    key,
    expected,
    correct,
  }: {
    key: string;
    expected: string;
    correct: boolean;
  }) {
    const now = performance.now();
    events.push({ key, expected, correct, timestamp: now });
    lastKeypressTime = now;
  }

  /* ── tick (called every SNAPSHOT_INTERVAL_S seconds) ───────────── */
  function tick() {
    const elapsedSeconds = roundTo((performance.now() - startPerf) / 1000, 1);
    const elapsedMinutes = elapsedSeconds / 60;
    if (elapsedMinutes < 0.05) return; /* too early for a meaningful WPM */

    const correctSoFar = events.filter(e => e.correct).length;
    const wpm = Math.round(correctSoFar / CHARS_PER_WORD / elapsedMinutes);

    snapshots.push({ elapsedSeconds, wpm });
  }

  /* ── getLiveWpm ─────────────────────────────────────────────────── */
  function getliveWpm(): number {
    const elapsedMinutes = (performance.now() - startPerf) / 1000 / 60;
    if (elapsedMinutes < 0.05) return 0;
    const correct = events.filter(e => e.correct).length;
    return Math.round(correct / CHARS_PER_WORD / elapsedMinutes);
  }

  /* ── getLiveAccuracy ────────────────────────────────────────────── */
  function getLiveAccuracy(): number {
    if (events.length === 0) return 100;
    const correct = events.filter(e => e.correct).length;
    return Math.round((correct / events.length) * 100);
  }

  /* ── finish ─────────────────────────────────────────────────────── */
  function finish(): SessionReport {
    const endPerf        = performance.now();
    const durationSeconds = roundTo((endPerf - startPerf) / 1000, 1);
    const elapsedMinutes  = durationSeconds / 60;

    /* Take one final snapshot */
    tick();

    /* ── Core numbers ─────────────────────────────────────────────── */
    const correctChars = events.filter(e => e.correct).length;
    const errorChars   = events.filter(e => !e.correct).length;
    const totalChars   = events.length;

    const wpm    = elapsedMinutes > 0
      ? Math.round(correctChars / CHARS_PER_WORD / elapsedMinutes)
      : 0;
    const rawWpm = elapsedMinutes > 0
      ? Math.round(totalChars / CHARS_PER_WORD / elapsedMinutes)
      : 0;
    const accuracy = totalChars > 0
      ? Math.round((correctChars / totalChars) * 100)
      : 100;

    /* ── Consistency ─────────────────────────────────────────────────
       Std-deviation of WPM snapshots, normalised to 0–100.
       100 = every snapshot is the same WPM.
       Formula: consistency = max(0, 100 - (stdDev / mean * 100))
    ─────────────────────────────────────────────────────────────────── */
    let consistency = 100;
    if (snapshots.length >= 2) {
      const wpmValues = snapshots.map(s => s.wpm);
      const mean      = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
      const variance  = wpmValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / wpmValues.length;
      const stdDev    = Math.sqrt(variance);
      consistency = mean > 0
        ? Math.round(Math.max(0, 100 - (stdDev / mean) * 100))
        : 100;
    }

    /* ── Per-key stats ───────────────────────────────────────────────
       Group events by the *expected* key (not what was pressed).
       This correctly attributes errors — if you pressed 'r' when 'e'
       was expected, that's a miss on 'e', not a stat on 'r'.
    ─────────────────────────────────────────────────────────────────── */
    const keyMap: Map<string, { correct: number; attempts: number; reactionDeltas: number[] }> = new Map();

    events.forEach((evt, i) => {
      const k = evt.expected;
      if (!keyMap.has(k)) keyMap.set(k, { correct: 0, attempts: 0, reactionDeltas: [] });
      const entry = keyMap.get(k)!;
      entry.attempts += 1;
      if (evt.correct) entry.correct += 1;

      /* Reaction time = delta from previous event (skip first) */
      if (i > 0) {
        const delta = evt.timestamp - events[i - 1].timestamp;
        /* Ignore deltas > 3 s (user paused, looked away etc.) */
        if (delta < 3000) entry.reactionDeltas.push(delta);
      }
    });

    const keyStats: KeyStat[] = Array.from(keyMap.entries())
      .map(([key, data]) => {
        const avgReactionMs = data.reactionDeltas.length > 0
          ? Math.round(data.reactionDeltas.reduce((a, b) => a + b, 0) / data.reactionDeltas.length)
          : 0;
        return {
          key,
          attempts:     data.attempts,
          correct:      data.correct,
          accuracy:     Math.round((data.correct / data.attempts) * 100),
          avgReactionMs,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy); /* worst first */

    /* ── Strong / weak / slow key lists ──────────────────────────── */
    const MIN_ATTEMPTS = 3;

    const strongKeys = keyStats
      .filter(k => k.accuracy >= 95 && k.attempts >= MIN_ATTEMPTS)
      .map(k => k.key);

    const weakKeys = keyStats
      .filter(k => k.accuracy < 80 && k.attempts >= MIN_ATTEMPTS)
      .map(k => k.key);

    /* Slow keys: reaction time in top 20% of all keys with enough data */
    const keysWithReaction = keyStats.filter(k => k.avgReactionMs > 0 && k.attempts >= MIN_ATTEMPTS);
    const reactionThreshold = (() => {
      if (keysWithReaction.length < 3) return Infinity;
      const sorted = [...keysWithReaction].sort((a, b) => b.avgReactionMs - a.avgReactionMs);
      const top20idx = Math.ceil(sorted.length * 0.2);
      return sorted[top20idx]?.avgReactionMs ?? Infinity;
    })();

    const slowKeys = keysWithReaction
      .filter(k => k.avgReactionMs >= reactionThreshold)
      .map(k => k.key);

    /* ── Personal best ────────────────────────────────────────────── */
    const isPersonalBest = params.prevBestWpm != null
      ? wpm > params.prevBestWpm
      : true; /* first session ever = always a PB */

    return {
      id:              uuid(),
      sessionType:     params.sessionType,
      lessonId:        params.lessonId,
      startedAt,
      durationSeconds,
      wpm,
      rawWpm,
      accuracy,
      correctChars,
      errorChars,
      totalChars,
      consistency,
      wpmSnapshots:   snapshots,
      keyStats,
      strongKeys,
      weakKeys,
      slowKeys,
      prevBestWpm:    params.prevBestWpm,
      prevAvgWpm:     params.prevAvgWpm,
      isPersonalBest,
    };
  }

  return { recordKeypress, tick, finish, getliveWpm, getLiveAccuracy };
}
