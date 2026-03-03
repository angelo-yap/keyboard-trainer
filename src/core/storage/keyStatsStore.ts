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
