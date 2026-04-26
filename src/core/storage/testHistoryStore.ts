import { getLS, setLS } from "./localStorage";

export type TestResult = {
  wpm: number;
  rawWpm?: number;
  accuracy: number;
  errors: number;
  chars: number;
  elapsed?: number;
  duration?: number;
  date: string;
  completed?: boolean;
  demo?: boolean;
  testMode?: "standard" | "adaptive" | "quotes" | "code";
  contentTitle?: string;
  contentAuthor?: string;
  contentLanguage?: string;
};

function isCompletedTest(result: TestResult): boolean {
  return result.completed !== false;
}

function getAllTestHistory(): TestResult[] {
  return getLS("kt_tests", []);
}

export function getTestHistory(): TestResult[] {
  return getAllTestHistory().filter(isCompletedTest);
}

export function saveTestResult(result: TestResult): TestResult[] {
  const history = getAllTestHistory();
  if (result.completed === false) {
    return history.filter(isCompletedTest);
  }

  const next = [{ ...result, completed: true, date: new Date().toISOString() }, ...history].slice(0, 100);
  setLS("kt_tests", next);
  return next.filter(isCompletedTest);
}

export function getPersonalBest(): number | null {
  const history = getTestHistory();
  if (history.length === 0) return null;
  return Math.max(...history.map((h) => h.wpm));
}

export function getAverageWpm(): number {
  const history = getTestHistory();
  if (history.length === 0) return 0;
  return Math.round(
    history.reduce((a, b) => a + b.wpm, 0) / history.length
  );
}

export function getAverageAccuracy(): number {
  const history = getTestHistory();
  if (history.length === 0) return 0;
  return Math.round(
    history.reduce((a, b) => a + b.accuracy, 0) / history.length
  );
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getWpmDeltaThisWeek(): number {
  const history = getTestHistory();
  const cutoff = Date.now() - ONE_WEEK_MS;
  const thisWeek = history.filter(
    (h) => new Date(h.date).getTime() >= cutoff
  );
  const lastWeek = history.filter(
    (h) =>
      new Date(h.date).getTime() >= cutoff - ONE_WEEK_MS &&
      new Date(h.date).getTime() < cutoff
  );
  if (thisWeek.length === 0 || lastWeek.length === 0) return 0;
  const avgThis =
    thisWeek.reduce((a, b) => a + b.wpm, 0) / thisWeek.length;
  const avgLast =
    lastWeek.reduce((a, b) => a + b.wpm, 0) / lastWeek.length;
  return Math.round(avgThis - avgLast);
}

export function getAccuracyDeltaThisWeek(): number {
  const history = getTestHistory();
  const cutoff = Date.now() - ONE_WEEK_MS;
  const thisWeek = history.filter(
    (h) => new Date(h.date).getTime() >= cutoff
  );
  const lastWeek = history.filter(
    (h) =>
      new Date(h.date).getTime() >= cutoff - ONE_WEEK_MS &&
      new Date(h.date).getTime() < cutoff
  );
  if (thisWeek.length === 0 || lastWeek.length === 0) return 0;
  const avgThis =
    thisWeek.reduce((a, b) => a + b.accuracy, 0) / thisWeek.length;
  const avgLast =
    lastWeek.reduce((a, b) => a + b.accuracy, 0) / lastWeek.length;
  return Math.round(avgThis - avgLast);
}
