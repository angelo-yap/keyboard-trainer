const KEY = "kbdtrainer:v1";

const defaults = {
  learnDone: Array.from({ length: 10 }, () => false),
  bestWpm: 0,
  streak: 0,
  lastActiveDay: null,
  practiceKeyStats: {}, // { a: {samples, errors}, ... }
  testHistory: [], // [{ts,wpm,acc,secs}]
  settings: { sound: false, goalMin: 30 },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaults;
  }
}

export function saveState(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function updateState(fn) {
  const cur = loadState();
  const next = fn(cur);
  saveState(next);
  return next;
}

export function sameDayISO(a, b) {
  return a && b && a.slice(0, 10) === b.slice(0, 10);
}