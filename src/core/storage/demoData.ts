import type { KeyStats } from "./keyStatsStore";
import { getLS, setLS } from "./localStorage";
import type { TestResult } from "./testHistoryStore";
import type { SessionReport } from "../session/sessionMetrics";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_SAMPLE_BASE = 1_700_000_000_000;
const DEMO_SAMPLE_END = DEMO_SAMPLE_BASE + 10_000_000;

type DemoSessionInput = {
  daysAgo: number;
  duration: number;
  testMode: "standard" | "adaptive" | "quotes" | "code";
  contentTitle?: string;
  contentAuthor?: string;
  contentLanguage?: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  totalChars: number;
  errors: number;
  consistency: number;
  handScore: number;
};

type DemoKeyInput = {
  key: string;
  attempts: number;
  errors: number;
  latencyMs: number;
};

const DEMO_SESSIONS: DemoSessionInput[] = [
  { daysAgo: 30, duration: 30, testMode: "standard", wpm: 39, rawWpm: 44, accuracy: 89, totalChars: 111, errors: 12, consistency: 70, handScore: 74 },
  { daysAgo: 29, duration: 30, testMode: "standard", wpm: 41, rawWpm: 46, accuracy: 90, totalChars: 118, errors: 12, consistency: 72, handScore: 76 },
  { daysAgo: 28, duration: 45, testMode: "quotes", contentTitle: "Pride and Prejudice", contentAuthor: "Jane Austen", wpm: 40, rawWpm: 45, accuracy: 90, totalChars: 170, errors: 17, consistency: 73, handScore: 77 },
  { daysAgo: 27, duration: 30, testMode: "adaptive", wpm: 43, rawWpm: 48, accuracy: 91, totalChars: 122, errors: 11, consistency: 75, handScore: 78 },
  { daysAgo: 26, duration: 42, testMode: "code", contentTitle: "Binary Search", contentLanguage: "C", wpm: 38, rawWpm: 45, accuracy: 85, totalChars: 158, errors: 24, consistency: 69, handScore: 72 },
  { daysAgo: 25, duration: 60, testMode: "standard", wpm: 44, rawWpm: 49, accuracy: 91, totalChars: 245, errors: 22, consistency: 76, handScore: 79 },
  { daysAgo: 24, duration: 52, testMode: "quotes", contentTitle: "A Tale of Two Cities", contentAuthor: "Charles Dickens", wpm: 45, rawWpm: 49, accuracy: 92, totalChars: 214, errors: 17, consistency: 77, handScore: 80 },
  { daysAgo: 23, duration: 30, testMode: "adaptive", wpm: 46, rawWpm: 50, accuracy: 92, totalChars: 126, errors: 10, consistency: 78, handScore: 81 },
  { daysAgo: 22, duration: 48, testMode: "code", contentTitle: "Two Sum Hash Map", contentLanguage: "C++", wpm: 42, rawWpm: 49, accuracy: 86, totalChars: 196, errors: 27, consistency: 73, handScore: 76 },
  { daysAgo: 21, duration: 60, testMode: "standard", wpm: 47, rawWpm: 51, accuracy: 93, totalChars: 256, errors: 18, consistency: 80, handScore: 83 },
  { daysAgo: 20, duration: 44, testMode: "quotes", contentTitle: "Meditations", contentAuthor: "Marcus Aurelius", wpm: 46, rawWpm: 50, accuracy: 93, totalChars: 205, errors: 14, consistency: 80, handScore: 83 },
  { daysAgo: 19, duration: 30, testMode: "adaptive", wpm: 48, rawWpm: 52, accuracy: 93, totalChars: 132, errors: 9, consistency: 82, handScore: 84 },
  { daysAgo: 18, duration: 55, testMode: "code", contentTitle: "Longest Unique Substring", contentLanguage: "Python", wpm: 43, rawWpm: 50, accuracy: 87, totalChars: 229, errors: 30, consistency: 75, handScore: 78 },
  { daysAgo: 17, duration: 60, testMode: "standard", wpm: 49, rawWpm: 53, accuracy: 94, totalChars: 267, errors: 16, consistency: 84, handScore: 86 },
  { daysAgo: 16, duration: 50, testMode: "quotes", contentTitle: "Self-Reliance", contentAuthor: "Ralph Waldo Emerson", wpm: 49, rawWpm: 53, accuracy: 94, totalChars: 221, errors: 13, consistency: 84, handScore: 86 },
  { daysAgo: 15, duration: 30, testMode: "adaptive", wpm: 50, rawWpm: 54, accuracy: 94, totalChars: 135, errors: 8, consistency: 85, handScore: 87 },
  { daysAgo: 14, duration: 47, testMode: "code", contentTitle: "Valid Parentheses", contentLanguage: "JavaScript", wpm: 46, rawWpm: 52, accuracy: 88, totalChars: 204, errors: 24, consistency: 79, handScore: 82 },
  { daysAgo: 13, duration: 60, testMode: "standard", wpm: 52, rawWpm: 55, accuracy: 95, totalChars: 278, errors: 14, consistency: 87, handScore: 88 },
  { daysAgo: 12, duration: 54, testMode: "quotes", contentTitle: "Walden", contentAuthor: "Henry David Thoreau", wpm: 51, rawWpm: 55, accuracy: 95, totalChars: 247, errors: 12, consistency: 87, handScore: 89 },
  { daysAgo: 11, duration: 30, testMode: "adaptive", wpm: 53, rawWpm: 56, accuracy: 95, totalChars: 141, errors: 7, consistency: 88, handScore: 90 },
  { daysAgo: 10, duration: 49, testMode: "code", contentTitle: "Prefix Sum", contentLanguage: "TypeScript", wpm: 48, rawWpm: 53, accuracy: 90, totalChars: 216, errors: 22, consistency: 82, handScore: 85 },
  { daysAgo: 9, duration: 60, testMode: "standard", wpm: 54, rawWpm: 57, accuracy: 96, totalChars: 286, errors: 11, consistency: 89, handScore: 90 },
  { daysAgo: 8, duration: 45, testMode: "quotes", contentTitle: "Jane Eyre", contentAuthor: "Charlotte Bronte", wpm: 54, rawWpm: 57, accuracy: 96, totalChars: 218, errors: 9, consistency: 90, handScore: 91 },
  { daysAgo: 7, duration: 30, testMode: "adaptive", wpm: 55, rawWpm: 58, accuracy: 96, totalChars: 145, errors: 6, consistency: 90, handScore: 91 },
  { daysAgo: 6, duration: 58, testMode: "code", contentTitle: "Dijkstra Shortest Path", contentLanguage: "Python", wpm: 50, rawWpm: 55, accuracy: 91, totalChars: 266, errors: 24, consistency: 84, handScore: 87 },
  { daysAgo: 5, duration: 120, testMode: "standard", wpm: 56, rawWpm: 59, accuracy: 96, totalChars: 596, errors: 24, consistency: 91, handScore: 92 },
  { daysAgo: 4, duration: 51, testMode: "quotes", contentTitle: "Little Women", contentAuthor: "Louisa May Alcott", wpm: 56, rawWpm: 59, accuracy: 97, totalChars: 251, errors: 8, consistency: 92, handScore: 93 },
  { daysAgo: 3, duration: 30, testMode: "adaptive", wpm: 58, rawWpm: 61, accuracy: 97, totalChars: 151, errors: 5, consistency: 92, handScore: 93 },
  { daysAgo: 2, duration: 43, testMode: "code", contentTitle: "Array Map And Filter", contentLanguage: "JavaScript", wpm: 53, rawWpm: 57, accuracy: 93, totalChars: 204, errors: 14, consistency: 88, handScore: 91 },
  { daysAgo: 1, duration: 60, testMode: "standard", wpm: 60, rawWpm: 62, accuracy: 98, totalChars: 310, errors: 6, consistency: 94, handScore: 95 },
  { daysAgo: 0, duration: 52, testMode: "quotes", contentTitle: "Frankenstein", contentAuthor: "Mary Shelley", wpm: 61, rawWpm: 63, accuracy: 98, totalChars: 273, errors: 5, consistency: 95, handScore: 95 },
];

const DEMO_KEYS: DemoKeyInput[] = [
  { key: "a", attempts: 42, errors: 1, latencyMs: 165 },
  { key: "e", attempts: 50, errors: 2, latencyMs: 172 },
  { key: "r", attempts: 37, errors: 4, latencyMs: 245 },
  { key: "t", attempts: 45, errors: 3, latencyMs: 215 },
  { key: "i", attempts: 36, errors: 1, latencyMs: 170 },
  { key: "o", attempts: 34, errors: 1, latencyMs: 185 },
  { key: "p", attempts: 20, errors: 4, latencyMs: 385 },
  { key: "q", attempts: 10, errors: 3, latencyMs: 520 },
  { key: "z", attempts: 12, errors: 4, latencyMs: 560 },
  { key: "1", attempts: 14, errors: 3, latencyMs: 410 },
  { key: "2", attempts: 16, errors: 2, latencyMs: 360 },
  { key: "0", attempts: 9, errors: 2, latencyMs: 455 },
  { key: ".", attempts: 22, errors: 2, latencyMs: 250 },
  { key: ",", attempts: 19, errors: 3, latencyMs: 310 },
  { key: ";", attempts: 12, errors: 3, latencyMs: 480 },
  { key: "(", attempts: 11, errors: 3, latencyMs: 510 },
  { key: ")", attempts: 11, errors: 2, latencyMs: 470 },
  { key: "{", attempts: 8, errors: 3, latencyMs: 620 },
  { key: "}", attempts: 8, errors: 3, latencyMs: 650 },
  { key: "=", attempts: 15, errors: 2, latencyMs: 390 },
  { key: "<", attempts: 10, errors: 2, latencyMs: 440 },
  { key: ">", attempts: 10, errors: 3, latencyMs: 500 },
];

function dateForDaysAgo(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * DAY_MS);
}

function buildSnapshots(wpm: number, duration: number) {
  const points = Math.max(2, Math.floor(duration / 10));
  return Array.from({ length: points }, (_, index) => {
    const progress = (index + 1) / points;
    const wobble = index % 2 === 0 ? -2 : 1;
    return {
      elapsedSeconds: Math.round(progress * duration),
      wpm: Math.max(1, Math.round(wpm - 4 + progress * 4 + wobble)),
    };
  });
}

function buildSessionKeyStats(input: DemoSessionInput) {
  const keys = ["a", "e", "r", "t", "i", "o", "p", ".", ",", "1", "(", ")"];
  return keys.map((key, index) => {
    const attempts = index < 6 ? 8 + (index % 4) : 4 + (index % 3);
    const weak = key === "q" || key === "p" || key === "(" || key === ")";
    const correct = Math.max(0, attempts - (weak ? 2 : index % 3 === 0 ? 1 : 0));
    return {
      key,
      attempts,
      correct,
      accuracy: Math.round((correct / attempts) * 100),
      avgReactionMs: 145 + index * 23,
    };
  });
}

function buildReport(input: DemoSessionInput, index: number, previousBest: number): SessionReport {
  const started = dateForDaysAgo(input.daysAgo);
  const correctChars = Math.max(0, input.totalChars - input.errors);
  const keyStats = buildSessionKeyStats(input);
  const weakKeys = keyStats.filter((key) => key.accuracy < 80 && key.attempts >= 3).map((key) => key.key);
  const slowKeys = keyStats
    .filter((key) => key.avgReactionMs >= 300 && key.attempts >= 3)
    .map((key) => key.key);

  return {
    id: `demo-session-${index + 1}`,
    sessionType: "test",
    testMode: input.testMode,
    contentTitle: input.contentTitle,
    contentAuthor: input.contentAuthor,
    contentLanguage: input.contentLanguage,
    demo: true,
    startedAt: started.getTime(),
    durationSeconds: input.duration,
    completed: true,
    wpm: input.wpm,
    rawWpm: input.rawWpm,
    accuracy: input.accuracy,
    correctChars,
    errorChars: input.errors,
    totalChars: input.totalChars,
    consistency: input.consistency,
    wpmSnapshots: buildSnapshots(input.wpm, input.duration),
    keyStats,
    strongKeys: keyStats.filter((key) => key.accuracy >= 95 && key.attempts >= 3).map((key) => key.key),
    weakKeys,
    slowKeys,
    handForm: {
      score: input.handScore,
      observedMs: input.duration * 850,
      badMs: Math.round(input.duration * (100 - input.handScore) * 5),
      coverage: 88 + (index % 8),
      badEvents: Math.max(1, Math.round((100 - input.handScore) / 4)),
      debounceMs: 300,
      keyStats: [
        { key: "p", observedMs: 4200, badMs: Math.max(300, (100 - input.handScore) * 35), score: Math.max(50, input.handScore - 14) },
        { key: "(", observedMs: 2800, badMs: Math.max(250, (100 - input.handScore) * 28), score: Math.max(52, input.handScore - 18) },
      ],
      weakKeys: input.handScore < 90 ? ["p", "("] : ["("],
      topWrongFingers: ["R_RING", "R_PINKY", "L_PINKY"].slice(0, 1 + (index % 3)),
    },
    prevBestWpm: previousBest || undefined,
    prevAvgWpm: index > 0
      ? Math.round(DEMO_SESSIONS.slice(0, index).reduce((sum, session) => sum + session.wpm, 0) / index)
      : undefined,
    isPersonalBest: input.wpm > previousBest,
  };
}

function buildTestHistory(reports: SessionReport[]): TestResult[] {
  return reports
    .slice()
    .reverse()
    .map((report) => ({
      wpm: report.wpm,
      rawWpm: report.rawWpm,
      accuracy: report.accuracy,
      errors: report.errorChars,
      chars: report.totalChars,
      duration: report.testMode === "standard" || report.testMode === "adaptive"
        ? report.durationSeconds
        : undefined,
      date: new Date(report.startedAt).toISOString(),
      completed: true,
      demo: true,
      testMode: report.testMode,
      contentTitle: report.contentTitle,
      contentAuthor: report.contentAuthor,
      contentLanguage: report.contentLanguage,
    }));
}

function buildKeyStats(): KeyStats {
  return Object.fromEntries(
    DEMO_KEYS.map((item) => {
      const samples = Array.from({ length: item.attempts }, (_, index) => ({
        error: index < item.errors,
        latencyMs: item.latencyMs + ((index % 5) - 2) * 18,
        at: DEMO_SAMPLE_BASE + index * 1000,
      }));
      const latencySamples = samples.filter((sample) => sample.latencyMs != null);
      return [
        item.key,
        {
          attempts: item.attempts,
          errors: item.errors,
          totalLatencyMs: latencySamples.reduce((sum, sample) => sum + (sample.latencyMs ?? 0), 0),
          latencySamples: latencySamples.length,
          slowAttempts: samples.filter((sample) => (sample.latencyMs ?? 0) >= 650).length,
          samples,
        },
      ];
    }),
  );
}

function entryFromRawSamples(samples: Array<{ error?: boolean; latencyMs?: number | null; at?: number }>) {
  const validSamples = samples
    .filter((sample): sample is { error: boolean; latencyMs: number | null; at: number } =>
      typeof sample.error === "boolean" &&
      typeof sample.at === "number"
    )
    .slice(-50);
  const latencySamples = validSamples.filter((sample) => typeof sample.latencyMs === "number");

  return {
    attempts: validSamples.length,
    errors: validSamples.filter((sample) => sample.error).length,
    totalLatencyMs: latencySamples.reduce((sum, sample) => sum + (sample.latencyMs ?? 0), 0),
    latencySamples: latencySamples.length,
    slowAttempts: validSamples.filter((sample) => (sample.latencyMs ?? 0) >= 650).length,
    samples: validSamples,
  };
}

function mergeDemoKeyStats(existing: KeyStats, demo: KeyStats): KeyStats {
  const merged: KeyStats = { ...existing };

  Object.entries(demo).forEach(([key, demoEntry]) => {
    const existingSamples = (existing[key]?.samples ?? []).filter(
      (sample) => sample.at < DEMO_SAMPLE_BASE || sample.at > DEMO_SAMPLE_END,
    );
    merged[key] = entryFromRawSamples([...existingSamples, ...demoEntry.samples]);
  });

  return merged;
}

export function seedDemoData(): void {
  let previousBest = 0;
  const reports = DEMO_SESSIONS.map((session, index) => {
    const report = buildReport(session, index, previousBest);
    previousBest = Math.max(previousBest, session.wpm);
    return report;
  });

  const existingTests = getLS<Array<TestResult & { demo?: boolean }>>("kt_tests", [])
    .filter((result) => result.demo !== true);
  const nextTests = [...buildTestHistory(reports), ...existingTests].slice(0, 100);

  const existingReports = getLS<SessionReport[]>("tf_session_history", [])
    .filter((report) => !report.id.startsWith("demo-session-"));
  const nextReports = [...existingReports, ...reports]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-200);

  const existingKeyStats = getLS<KeyStats>("kt_keystats", {});
  const nextKeyStats = mergeDemoKeyStats(existingKeyStats, buildKeyStats());
  const currentStreak = getLS("kt_streak", { count: 0, lastDate: null as string | null });

  setLS("kt_tests", nextTests);
  setLS("tf_session_history", nextReports);
  setLS("kt_keystats", nextKeyStats);
  setLS("kt_streak", {
    count: Math.max(currentStreak.count, 31),
    lastDate: new Date().toDateString(),
  });
}
