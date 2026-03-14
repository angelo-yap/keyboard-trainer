import { getLS, setLS } from "./localStorage";

export type KeyStats = Record<string, { attempts: number; errors: number }>;

export function getKeyStats(): KeyStats {
  return getLS("kt_keystats", {});
}

export function recordKeyStats(char: string, wasError: boolean): void {
  const stats = getKeyStats();
  const key = char.toLowerCase();
  if (!stats[key]) stats[key] = { attempts: 0, errors: 0 };
  stats[key].attempts++;
  if (wasError) stats[key].errors++;
  setLS("kt_keystats", stats);
}

export function getAccuracy(key: string): number | null {
  const stats = getKeyStats();
  const k = key.toLowerCase();
  const s = stats[k];
  if (!s || s.attempts < 3) return null;
  return Math.round(((s.attempts - s.errors) / s.attempts) * 100);
}

export function getWeakKeys(): { key: string; accuracy: number }[] {
  const stats = getKeyStats();
  return Object.entries(stats)
    .filter(([, v]) => v.attempts >= 3)
    .map(([key, v]) => ({
      key,
      accuracy: Math.round(((v.attempts - v.errors) / v.attempts) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}
