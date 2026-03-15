import { getLS, setLS } from "./localStorage";

export type Streak = {
  count: number;
  lastDate: string | null;
};

export function getStreak(): Streak {
  return getLS("kt_streak", { count: 0, lastDate: null });
}

export function updateStreak(): Streak {
  const streak = getStreak();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (streak.lastDate === today) return streak;
  const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
  const next = { count: newCount, lastDate: today };
  setLS("kt_streak", next);
  return next;
}
