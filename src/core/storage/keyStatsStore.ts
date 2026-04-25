import { getLS, setLS } from "./localStorage";

export type KeyAttemptSample = {
  error: boolean;
  latencyMs: number | null;
  at: number;
};

export type KeyStatEntry = {
  attempts: number;
  errors: number;
  totalLatencyMs: number;
  latencySamples: number;
  slowAttempts: number;
  samples: KeyAttemptSample[];
};

export type KeyStats = Record<string, KeyStatEntry>;
export type WeakKeyStat = {
  key: string;
  accuracy: number;
  attempts: number;
  errors: number;
  avgLatencyMs: number | null;
  score: number;
};

export const KEY_ATTEMPT_WINDOW = 50;

const MAX_TRACKED_LATENCY_MS = 3000;
const SLOW_KEY_LATENCY_MS = 650;
const HESITATION_GRACE_MS = 450;
const HESITATION_MAX_MS = 1200;
const MAX_HESITATION_PENALTY = 30;

type StoredKeyStatEntry = Partial<KeyStatEntry> & {
  samples?: Partial<KeyAttemptSample>[];
};

function normalizeSample(value: Partial<KeyAttemptSample>): KeyAttemptSample | null {
  if (typeof value.error !== "boolean") return null;
  const latencyMs =
    typeof value.latencyMs === "number" &&
    Number.isFinite(value.latencyMs) &&
    value.latencyMs > 0 &&
    value.latencyMs <= MAX_TRACKED_LATENCY_MS
      ? value.latencyMs
      : null;
  const at =
    typeof value.at === "number" && Number.isFinite(value.at)
      ? value.at
      : Date.now();

  return {
    error: value.error,
    latencyMs,
    at,
  };
}

function entryFromSamples(samples: KeyAttemptSample[]): KeyStatEntry {
  const windowedSamples = samples.slice(-KEY_ATTEMPT_WINDOW);
  const latencySamples = windowedSamples.filter((sample) => sample.latencyMs != null);

  return {
    attempts: windowedSamples.length,
    errors: windowedSamples.filter((sample) => sample.error).length,
    totalLatencyMs: latencySamples.reduce((sum, sample) => sum + (sample.latencyMs ?? 0), 0),
    latencySamples: latencySamples.length,
    slowAttempts: windowedSamples.filter(
      (sample) => sample.latencyMs != null && sample.latencyMs >= SLOW_KEY_LATENCY_MS,
    ).length,
    samples: windowedSamples,
  };
}

function legacyEntry(value: StoredKeyStatEntry | undefined): KeyStatEntry {
  return {
    attempts: Math.max(0, Number(value?.attempts) || 0),
    errors: Math.max(0, Number(value?.errors) || 0),
    totalLatencyMs: Math.max(0, Number(value?.totalLatencyMs) || 0),
    latencySamples: Math.max(0, Number(value?.latencySamples) || 0),
    slowAttempts: Math.max(0, Number(value?.slowAttempts) || 0),
    samples: [],
  };
}

function normalizeEntry(value: StoredKeyStatEntry | undefined): KeyStatEntry {
  const samples = Array.isArray(value?.samples)
    ? value.samples
        .map((sample) => normalizeSample(sample))
        .filter((sample): sample is KeyAttemptSample => sample != null)
    : [];

  return samples.length > 0 ? entryFromSamples(samples) : legacyEntry(value);
}

function getAccuracyForEntry(entry: KeyStatEntry): number {
  return entry.attempts > 0
    ? Math.round(((entry.attempts - entry.errors) / entry.attempts) * 100)
    : 100;
}

function getAverageLatencyForEntry(entry: KeyStatEntry): number | null {
  return entry.latencySamples > 0
    ? Math.round(entry.totalLatencyMs / entry.latencySamples)
    : null;
}

function getHesitationPenalty(avgLatencyMs: number | null): number {
  if (avgLatencyMs == null || avgLatencyMs <= HESITATION_GRACE_MS) return 0;
  const progress = Math.min(
    1,
    (avgLatencyMs - HESITATION_GRACE_MS) / (HESITATION_MAX_MS - HESITATION_GRACE_MS),
  );
  return Math.round(progress * MAX_HESITATION_PENALTY);
}

function getScoreForEntry(entry: KeyStatEntry): number {
  const accuracy = getAccuracyForEntry(entry);
  const avgLatencyMs = getAverageLatencyForEntry(entry);
  return Math.max(0, accuracy - getHesitationPenalty(avgLatencyMs));
}

export function getKeyStats(): KeyStats {
  const raw = getLS("kt_keystats", {}) as Record<string, StoredKeyStatEntry>;
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, normalizeEntry(value)]),
  );
}

export function recordKeyStats(char: string, wasError: boolean, latencyMs?: number | null): void {
  const stats = getKeyStats();
  const key = char.toLowerCase();
  const sampleLatencyMs =
    typeof latencyMs === "number" &&
    Number.isFinite(latencyMs) &&
    latencyMs > 0 &&
    latencyMs <= MAX_TRACKED_LATENCY_MS
      ? latencyMs
      : null;
  const current = stats[key] ?? entryFromSamples([]);
  const samples = [
    ...current.samples,
    {
      error: wasError,
      latencyMs: sampleLatencyMs,
      at: Date.now(),
    },
  ].slice(-KEY_ATTEMPT_WINDOW);

  stats[key] = entryFromSamples(samples);
  setLS("kt_keystats", stats);
}

export function getAccuracy(key: string): number | null {
  const stats = getKeyStats();
  const k = key.toLowerCase();
  const s = stats[k];
  if (!s || s.attempts < 3) return null;
  return getAccuracyForEntry(s);
}

export function getAverageLatency(key: string): number | null {
  const stats = getKeyStats();
  const s = stats[key.toLowerCase()];
  if (!s || s.attempts < 3) return null;
  return getAverageLatencyForEntry(s);
}

export function getKeyScore(key: string): number | null {
  const stats = getKeyStats();
  const s = stats[key.toLowerCase()];
  if (!s || s.attempts < 3) return null;
  return getScoreForEntry(s);
}

export function getWeakKeys(): WeakKeyStat[] {
  const stats = getKeyStats();
  return Object.entries(stats)
    .filter(([, v]) => v.attempts >= 3)
    .map(([key, v]) => ({
      key,
      attempts: v.attempts,
      errors: v.errors,
      accuracy: getAccuracyForEntry(v),
      avgLatencyMs: getAverageLatencyForEntry(v),
      score: getScoreForEntry(v),
    }))
    .filter((entry) => entry.score < 98)
    .sort((a, b) => {
      const scoreDiff = a.score - b.score;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.avgLatencyMs ?? 0) - (a.avgLatencyMs ?? 0);
    });
}

export function getWeakLetterTargets(limit = 5): WeakKeyStat[] {
  const stats = getKeyStats();
  return Object.entries(stats)
    .filter(([key, value]) => /^[a-z]$/.test(key) && value.attempts >= 5)
    .map(([key, value]) => ({
      key,
      attempts: value.attempts,
      errors: value.errors,
      accuracy: getAccuracyForEntry(value),
      avgLatencyMs: getAverageLatencyForEntry(value),
      score: getScoreForEntry(value),
    }))
    .filter((entry) => entry.score < 98)
    .sort((a, b) => {
      const severityA = (100 - a.score) * 10 + a.errors;
      const severityB = (100 - b.score) * 10 + b.errors;
      return severityB - severityA;
    })
    .slice(0, limit);
}
