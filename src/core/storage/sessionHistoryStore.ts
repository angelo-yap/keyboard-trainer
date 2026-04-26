/* ─── src/core/storage/sessionHistoryStore.ts ────────────────────────────────
   Persists SessionReport objects to localStorage and provides read helpers
   used by the report card and the analytics route.
   ──────────────────────────────────────────────────────────────────────── */

import type { SessionReport } from '../session/sessionMetrics';

const STORAGE_KEY = 'tf_session_history';
const MAX_STORED  = 200; /* rolling window — oldest dropped when full */

/* ── Internal helpers ─────────────────────────────────────────────────── */

function load(): SessionReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionReport[]) : [];
  } catch {
    return [];
  }
}

function persist(sessions: SessionReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* Storage full — trim and retry */
    const trimmed = sessions.slice(-Math.floor(MAX_STORED / 2));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
  }
}

function isCompletedReport(report: SessionReport): boolean {
  return report.completed !== false;
}

function loadCompleted(): SessionReport[] {
  return load().filter(isCompletedReport);
}

/* ── Public API ───────────────────────────────────────────────────────── */

export const sessionHistoryStore = {
  /** Save a completed session report */
  save(report: SessionReport): void {
    if (report.completed === false) {
      return;
    }

    const all = load();
    all.push(report);
    /* Keep only the most recent MAX_STORED */
    if (all.length > MAX_STORED) all.splice(0, all.length - MAX_STORED);
    persist(all);
  },

  /** All sessions, oldest first */
  getAll(): SessionReport[] {
    return loadCompleted();
  },

  /** Most recent N sessions (newest first) */
  getRecent(n = 10): SessionReport[] {
    return loadCompleted().slice(-n).reverse();
  },

  /** Personal best WPM across all sessions */
  getPersonalBest(): number | undefined {
    const all = loadCompleted();
    if (all.length === 0) return undefined;
    return Math.max(...all.map(s => s.wpm));
  },

  /** Rolling average WPM over the last N sessions */
  getAverageWpm(n = 20): number {
    const recent = loadCompleted().slice(-n);
    if (recent.length === 0) return 0;
    return Math.round(recent.reduce((s, r) => s + r.wpm, 0) / recent.length);
  },

  /** WPM delta vs the previous N-session window */
  getWpmDeltaThisWeek(): number {
    const all = loadCompleted();
    if (all.length < 4) return 0;
    const recent   = all.slice(-7).map(s => s.wpm);
    const previous = all.slice(-14, -7).map(s => s.wpm);
    if (previous.length === 0) return 0;
    const avgRecent   = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgPrevious = previous.reduce((a, b) => a + b, 0) / previous.length;
    return Math.round(avgRecent - avgPrevious);
  },

  /** Aggregate weak key list across the last N sessions */
  getAggregateWeakKeys(n = 10): { key: string; accuracy: number }[] {
    const recent = loadCompleted().slice(-n);
    const totals: Map<string, { correct: number; attempts: number }> = new Map();

    recent.forEach(session => {
      session.keyStats.forEach(ks => {
        if (!totals.has(ks.key)) totals.set(ks.key, { correct: 0, attempts: 0 });
        const t = totals.get(ks.key)!;
        t.correct  += ks.correct;
        t.attempts += ks.attempts;
      });
    });

    return Array.from(totals.entries())
      .filter(([, v]) => v.attempts >= 5)
      .map(([key, v]) => ({
        key,
        accuracy: Math.round((v.correct / v.attempts) * 100),
      }))
      .filter(k => k.accuracy < 85)
      .sort((a, b) => a.accuracy - b.accuracy);
  },

  /** WPM history for trend chart — one point per session (last N) */
  getWpmHistory(n = 30): { date: number; wpm: number }[] {
    return loadCompleted()
      .slice(-n)
      .map(s => ({ date: s.startedAt, wpm: s.wpm }));
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
