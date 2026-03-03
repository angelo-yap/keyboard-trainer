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
};

export function getTestHistory(): TestResult[] {
  return getLS("kt_tests", []);
}

export function saveTestResult(result: TestResult): TestResult[] {
  const history = getTestHistory();
  history.unshift({ ...result, date: new Date().toISOString() });
  setLS("kt_tests", history.slice(0, 100));
  return history;
}
