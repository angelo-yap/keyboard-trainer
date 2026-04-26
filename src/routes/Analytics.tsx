import { getTestHistory } from "../core/storage/testHistoryStore";
import { getPracticeProgress } from "../core/storage/progressStore";
import { getAverageLatency, getKeyScore, getKeyStats } from "../core/storage/keyStatsStore";
import { getStreak } from "../core/storage/streakStore";
import { sessionHistoryStore } from "../core/storage/sessionHistoryStore";
import type { SessionReport } from "../core/session/sessionMetrics";
import { PRACTICE_LESSONS } from "../core/lesson/lessons/practiceLessons";
import { formatKeyLabel } from "../core/text/formatChar";
import { Button } from "../ui/components/Button";
import "./Analytics.css";

type AnalyticsProps = {
  onBack: () => void;
};

type HandFormReview = {
  testCount: number;
  trackedCount: number;
  score: number;
  coverage: number;
  badMs: number;
  badEvents: number;
  weakKeys: Array<{ key: string; score: number; observedMs: number }>;
  topWrongFingers: string[];
};

const HAND_FORM_REVIEW_WINDOW = 20;
const DEFAULT_TEST_DURATIONS = [15, 30, 60, 120] as const;

function buildHandFormReview(reports: SessionReport[]): HandFormReview {
  const recentTests = reports
    .filter((report) => report.sessionType === "test" && report.completed !== false)
    .slice(-HAND_FORM_REVIEW_WINDOW);
  const trackedTests = recentTests.filter((report) => report.handForm);
  const totalObservedMs = trackedTests.reduce((sum, report) => sum + (report.handForm?.observedMs ?? 0), 0);
  const totalBadMs = trackedTests.reduce((sum, report) => sum + (report.handForm?.badMs ?? 0), 0);
  const totalDurationMs = trackedTests.reduce((sum, report) => sum + report.durationSeconds * 1000, 0);
  const keyMap = new Map<string, { observedMs: number; badMs: number }>();
  const fingerCounts = new Map<string, number>();

  trackedTests.forEach((report) => {
    report.handForm?.keyStats.forEach((keyStat) => {
      const entry = keyMap.get(keyStat.key) ?? { observedMs: 0, badMs: 0 };
      entry.observedMs += keyStat.observedMs;
      entry.badMs += keyStat.badMs;
      keyMap.set(keyStat.key, entry);
    });

    report.handForm?.topWrongFingers.forEach((finger) => {
      fingerCounts.set(finger, (fingerCounts.get(finger) ?? 0) + 1);
    });
  });

  const weakKeys = Array.from(keyMap.entries())
    .filter(([, data]) => data.observedMs >= 500)
    .map(([key, data]) => ({
      key,
      observedMs: data.observedMs,
      score: Math.round(Math.max(0, 100 - (data.badMs / data.observedMs) * 100)),
    }))
    .filter((key) => key.score < 90)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  return {
    testCount: recentTests.length,
    trackedCount: trackedTests.length,
    score: totalObservedMs > 0
      ? Math.round(Math.max(0, 100 - (totalBadMs / totalObservedMs) * 100))
      : 0,
    coverage: totalDurationMs > 0
      ? Math.round(Math.min(100, (totalObservedMs / totalDurationMs) * 100))
      : 0,
    badMs: Math.round(totalBadMs),
    badEvents: trackedTests.reduce((sum, report) => sum + (report.handForm?.badEvents ?? 0), 0),
    weakKeys,
    topWrongFingers: Array.from(fingerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([finger]) => finger),
  };
}

function formatSecondsFromMs(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

function formatFingerLabel(finger: string): string {
  const [hand, ...parts] = finger.split("_");
  const handLabel = hand === "L" ? "Left" : hand === "R" ? "Right" : hand;
  const fingerLabel = parts.join(" ").toLowerCase();
  return `${handLabel} ${fingerLabel}`;
}

function formatCardDate(date: string | null): string {
  if (!date) return "No test yet";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Analytics({ onBack }: AnalyticsProps) {
  const history = getTestHistory();
  const handFormReview = buildHandFormReview(sessionHistoryStore.getAll());
  const progress = getPracticeProgress();
  const keyStats = getKeyStats();
  const streak = getStreak();

  const bestWpm = history.length ? Math.max(...history.map((h) => h.wpm)) : 0;
  const avgWpm = history.length
    ? Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length)
    : 0;
  const avgAcc = history.length
    ? Math.round(history.reduce((a, b) => a + b.accuracy, 0) / history.length)
    : 0;

  const chartData = history.slice(0, 20).reverse();
  const maxWpm = chartData.length ? Math.max(...chartData.map((h) => h.wpm), 10) : 100;

  const testDurations = Array.from(
    new Set([
      ...DEFAULT_TEST_DURATIONS,
      ...history
        .map((entry) => entry.duration)
        .filter((duration): duration is number => typeof duration === "number" && duration > 0),
    ])
  ).sort((a, b) => a - b);

  const wpmByDuration = testDurations.map((duration) => {
    const tests = history.filter((entry) => entry.duration === duration);
    if (tests.length === 0) {
      return {
        duration,
        sessions: 0,
        averageWpm: null,
        bestWpm: null,
        averageAccuracy: null,
        bestAccuracy: null,
        bestTestDate: null,
      };
    }

    const bestWpmTest = tests.reduce((best, test) => {
      if (test.wpm > best.wpm) return test;
      if (test.wpm < best.wpm) return best;
      return new Date(test.date).getTime() > new Date(best.date).getTime() ? test : best;
    }, tests[0]);

    return {
      duration,
      sessions: tests.length,
      averageWpm: Math.round(tests.reduce((sum, test) => sum + test.wpm, 0) / tests.length),
      bestWpm: Math.max(...tests.map((test) => test.wpm)),
      averageAccuracy: Math.round(
        tests.reduce((sum, test) => sum + test.accuracy, 0) / tests.length
      ),
      bestAccuracy: Math.max(...tests.map((test) => test.accuracy)),
      bestTestDate: bestWpmTest?.date ?? null,
    };
  });

  const keyList = Object.entries(keyStats)
    .map(([k, v]) => ({
      key: k,
      accuracy: Math.round(((v.attempts - v.errors) / v.attempts) * 100),
      score: getKeyScore(k) ?? Math.round(((v.attempts - v.errors) / v.attempts) * 100),
      avgLatencyMs: getAverageLatency(k),
      attempts: v.attempts,
      errors: v.errors,
    }))
    .filter((k) => k.attempts >= 3)
    .sort((a, b) => a.score - b.score);

  const worstKeys = keyList.slice(0, 8);
  const bestKeys = keyList.slice(-8).reverse();

  return (
    <div className="analytics">
      <div className="analytics-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div className="analytics-title">Analytics</div>
      </div>

      <div className="analytics-stats">
        {[
          ["Best WPM", bestWpm || "—", "var(--color-accent)"],
          ["Avg WPM", avgWpm || "—", "var(--color-text)"],
          ["Avg Accuracy", avgAcc ? avgAcc + "%" : "—", avgAcc >= 95 ? "var(--color-correct)" : "var(--color-text)"],
          ["Sessions", history.length, "var(--color-text-2)"],
          ["Streak", streak.count + " days", "var(--color-accent)"],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="analytics-stat-card">
            <div className="analytics-stat-label">{label}</div>
            <div className="analytics-stat-value" style={{ color: color as string }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-sections">
        <section className="analytics-section" aria-label="Overview">

          {chartData.length >= 2 ? (
            <div className="analytics-panel">
              <div className="analytics-panel-title">
                WPM Progress (last {chartData.length} tests)
              </div>
              <WpmChart data={chartData} maxWpm={maxWpm} />
            </div>
          ) : (
            <Empty msg="Complete at least 2 tests to see your progress chart" />
          )}

          <div className="analytics-panel">
            <div className="analytics-panel-title">WPM by test duration</div>
            <div className="analytics-duration-grid">
              {wpmByDuration.map((entry) => (
                <div key={entry.duration} className="analytics-duration-card" tabIndex={0}>
                  <div className="analytics-duration-title">{entry.duration}s</div>
                  <div className="analytics-duration-value">
                    {entry.bestWpm != null ? `${entry.bestWpm} best WPM` : "—"}
                  </div>
                  <div className="analytics-duration-accuracy">
                    {entry.bestAccuracy != null ? `${entry.bestAccuracy}% best acc` : "—"}
                  </div>
                  <div className="analytics-duration-date">
                    Best test: {formatCardDate(entry.bestTestDate)}
                  </div>
                  <div className="analytics-duration-hover" aria-hidden="true">
                    <div className="analytics-duration-hover-line">
                      Avg WPM: {entry.averageWpm != null ? entry.averageWpm : "—"}
                    </div>
                    <div className="analytics-duration-hover-line">
                      Avg Accuracy: {entry.averageAccuracy != null ? `${entry.averageAccuracy}%` : "—"}
                    </div>
                    <div className="analytics-duration-hover-line">
                      Sessions: {entry.sessions}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-keys-grid">
            <div className="analytics-panel">
              <div className="analytics-panel-title">Weakest keys</div>
              {worstKeys.length ? (
                <KeyGrid keys={worstKeys} variant="weak" />
              ) : (
                <Empty msg="Not enough data yet" />
              )}
            </div>
            <div className="analytics-panel">
              <div className="analytics-panel-title">Strongest keys</div>
              {bestKeys.length ? (
                <KeyGrid keys={bestKeys} variant="strong" />
              ) : (
                <Empty msg="Not enough data yet" />
              )}
            </div>
          </div>

          <HandFormReviewPanel review={handFormReview} />
        
        <div className="analytics-panel">
            <div className="analytics-panel-title">
              All test sessions ({history.length})
            </div>
            {history.length === 0 ? (
              <Empty msg="No tests yet" />
            ) : (
              <div className="analytics-history-list">
                {history.map((h, i) => (
                  <div key={i} className="analytics-history-item">
                    <span className="analytics-history-wpm">{h.wpm} WPM</span>
                    <span
                      className={`analytics-history-acc analytics-history-acc--${
                        h.accuracy >= 95 ? "good" : h.accuracy >= 85 ? "warn" : "weak"
                      }`}
                    >
                      {h.accuracy}% acc
                    </span>
                    {h.errors !== undefined && (
                      <span className="analytics-history-err">{h.errors} err</span>
                    )}
                    {h.duration && (
                      <span className="analytics-history-dur">{h.duration}s</span>
                    )}
                    <span className="analytics-history-date">
                      {new Date(h.date).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        
        </section>
          
        

      </div>
    </div>
  );
}

function HandFormReviewPanel({ review }: { review: HandFormReview }) {
  return (
    <div className="analytics-panel">
      <div className="analytics-panel-title">
        Hand form review (last {HAND_FORM_REVIEW_WINDOW} tests)
      </div>
      {review.trackedCount === 0 ? (
        <Empty msg="No hand-tracked test data in the last 20 tests" />
      ) : (
        <div className="hand-form-review">
          <div className="hand-form-review-main">
            <div className="hand-form-score">
              <div className="hand-form-score-value">{review.score}%</div>
              <div className="hand-form-score-label">
                {review.trackedCount} of {review.testCount} tests tracked
              </div>
            </div>
            <div className="hand-form-metrics">
              <Metric label="bad form" value={formatSecondsFromMs(review.badMs)} />
              <Metric label="coverage" value={`${review.coverage}%`} />
              <Metric label="events" value={String(review.badEvents)} />
            </div>
          </div>

          {(review.weakKeys.length > 0 || review.topWrongFingers.length > 0) && (
            <div className="hand-form-review-detail">
              {review.weakKeys.length > 0 && (
                <div className="hand-form-review-group">
                  <div className="hand-form-review-label">form slip keys</div>
                  <div className="hand-form-key-list">
                    {review.weakKeys.map((key) => (
                      <span key={key.key} title={`${formatSecondsFromMs(key.observedMs)} observed`}>
                        {formatKeyLabel(key.key)} {key.score}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {review.topWrongFingers.length > 0 && (
                <div className="hand-form-review-group">
                  <div className="hand-form-review-label">watch fingers</div>
                  <div className="hand-form-finger-list">
                    {review.topWrongFingers.map((finger) => (
                      <span key={finger}>{formatFingerLabel(finger)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="hand-form-metric">
      <div className="hand-form-metric-label">{label}</div>
      <div className="hand-form-metric-value">{value}</div>
    </div>
  );
}

function WpmChart({
  data,
  maxWpm,
}: {
  data: { wpm: number; accuracy: number; date: string }[];
  maxWpm: number;
}) {
  const H = 120;
  const W_unit = Math.max(24, Math.min(48, 700 / data.length));

  return (
    <div className="wpm-chart">
      <div
        className="wpm-chart-bars"
        style={{
          height: H + 30,
          minWidth: data.length * (W_unit + 4),
        }}
      >
        {data.map((d, i) => {
          const h = Math.max(4, (d.wpm / maxWpm) * H);
          const isRecent = i === data.length - 1;
          return (
            <div key={i} className="wpm-chart-bar">
              <div
                className={`wpm-chart-value ${isRecent ? "recent" : ""}`}
              >
                {d.wpm}
              </div>
              <div
                className={`wpm-chart-rect wpm-chart-rect--${
                  isRecent ? "recent" : d.accuracy >= 95 ? "good" : "warn"
                }`}
                style={{
                  width: W_unit,
                  height: h,
                }}
                title={`${d.wpm} WPM, ${d.accuracy}% acc`}
              />
              <div className="wpm-chart-date">
                {new Date(d.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyGrid({
  keys,
  variant,
}: {
  keys: { key: string; accuracy: number; score: number; avgLatencyMs: number | null; attempts: number }[];
  variant: "weak" | "strong";
}) {
  return (
    <div className="key-grid">
      {keys.map(({ key, accuracy, score, avgLatencyMs, attempts }) => (
        <div
          key={key}
          className={`key-grid-item key-grid-item--${variant}`}
          title={`${attempts} attempts · ${accuracy}% accuracy${
            avgLatencyMs != null ? ` · ${avgLatencyMs}ms avg` : ""
          }`}
        >
          <div className="key-grid-key">{formatKeyLabel(key).toUpperCase()}</div>
          <div className="key-grid-acc">
            {score}%
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="analytics-empty">{msg}</div>
  );
}
