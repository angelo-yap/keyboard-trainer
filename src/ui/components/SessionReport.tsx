/* ─── src/ui/components/SessionReport.tsx ────────────────────────────────────
   Post-session report card. Receives a completed SessionReport and renders
   the full breakdown: headline stats, WPM trend, per-key analysis, verdict.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef } from 'react';
import './SessionReport.css';
import type { SessionReport, KeyStat } from '../../core/session/sessionMetrics';
import { formatKeyLabel } from '../../core/text/formatChar';

/* ── Props ────────────────────────────────────────────────────────────── */
interface SessionReportProps {
  report: SessionReport;
  onRetry:       () => void;   /* repeat the same session */
  onNextLesson?: () => void;   /* only shown for practice sessions */
  onHome:        () => void;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function gradeColor(accuracy: number): string {
  if (accuracy >= 98) return 'var(--color-correct)';
  if (accuracy >= 93) return 'var(--color-accent)';
  return 'var(--color-error)';
}

function consistencyLabel(c: number): string {
  if (c >= 90) return 'very consistent';
  if (c >= 75) return 'fairly consistent';
  if (c >= 55) return 'uneven';
  return 'erratic';
}

/* ── WPM Trend chart (pure Canvas, no library) ────────────────────────── */

interface WpmChartProps {
  snapshots: { elapsedSeconds: number; wpm: number }[];
  prevAvgWpm?: number;
}

const WpmChart: React.FC<WpmChartProps> = ({ snapshots, prevAvgWpm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length < 2) return;

    const dpr = window.devicePixelRatio ?? 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    /* ── Layout constants ─────────────────────────────────────────── */
    const PAD_L = 36, PAD_R = 16, PAD_T = 12, PAD_B = 28;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    /* ── Data bounds ──────────────────────────────────────────────── */
    const wpmValues   = snapshots.map(s => s.wpm);
    const maxWpm      = Math.max(...wpmValues, prevAvgWpm ?? 0, 10);
    const minWpm      = Math.max(0, Math.min(...wpmValues) - 5);
    const wpmRange    = maxWpm - minWpm || 1;
    const maxElapsed  = snapshots[snapshots.length - 1].elapsedSeconds;

    /* ── Coordinate helpers ───────────────────────────────────────── */
    function xOf(sec: number)  { return PAD_L + (sec / maxElapsed) * chartW; }
    function yOf(wpm: number)  { return PAD_T + chartH - ((wpm - minWpm) / wpmRange) * chartH; }

    /* ── Retrieve CSS variables for colours ───────────────────────── */
    const style       = getComputedStyle(canvas);
    const colorAccent = style.getPropertyValue('--color-accent').trim()  || '#C8A96E';
    const colorLine   = style.getPropertyValue('--color-line-2').trim()  || 'rgba(255,255,255,0.12)';
    const colorText3  = style.getPropertyValue('--color-text-3').trim()  || '#4A4844';
    const colorAvg    = style.getPropertyValue('--color-correct').trim() || '#4A9B6F';

    /* ── Grid lines ───────────────────────────────────────────────── */
    ctx.strokeStyle = colorLine;
    ctx.lineWidth   = 0.5;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const wpm = minWpm + (wpmRange / gridSteps) * i;
      const y   = yOf(wpm);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + chartW, y);
      ctx.stroke();

      ctx.fillStyle  = colorText3;
      ctx.font       = `10px IBM Plex Mono, monospace`;
      ctx.textAlign  = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(wpm)), PAD_L - 6, y);
    }

    /* ── Prev avg WPM reference line ──────────────────────────────── */
    if (prevAvgWpm && prevAvgWpm > minWpm) {
      const y = yOf(prevAvgWpm);
      ctx.strokeStyle = colorAvg;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle    = colorAvg;
      ctx.font         = `9px IBM Plex Mono, monospace`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('avg', PAD_L + 4, y - 2);
    }

    /* ── Area fill under WPM line ─────────────────────────────────── */
    const gradient = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
    gradient.addColorStop(0,   'rgba(200,169,110,0.18)');
    gradient.addColorStop(1,   'rgba(200,169,110,0)');

    ctx.beginPath();
    ctx.moveTo(xOf(snapshots[0].elapsedSeconds), yOf(snapshots[0].wpm));
    for (let i = 1; i < snapshots.length; i++) {
      ctx.lineTo(xOf(snapshots[i].elapsedSeconds), yOf(snapshots[i].wpm));
    }
    ctx.lineTo(xOf(maxElapsed), PAD_T + chartH);
    ctx.lineTo(PAD_L,           PAD_T + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    /* ── WPM line ─────────────────────────────────────────────────── */
    ctx.strokeStyle = colorAccent;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(xOf(snapshots[0].elapsedSeconds), yOf(snapshots[0].wpm));
    for (let i = 1; i < snapshots.length; i++) {
      ctx.lineTo(xOf(snapshots[i].elapsedSeconds), yOf(snapshots[i].wpm));
    }
    ctx.stroke();

    /* ── Dots at each snapshot ────────────────────────────────────── */
    snapshots.forEach(s => {
      ctx.beginPath();
      ctx.arc(xOf(s.elapsedSeconds), yOf(s.wpm), 3, 0, Math.PI * 2);
      ctx.fillStyle = colorAccent;
      ctx.fill();
    });

    /* ── X axis labels ────────────────────────────────────────────── */
    ctx.fillStyle    = colorText3;
    ctx.font         = `9px IBM Plex Mono, monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const labelCount = Math.min(snapshots.length, 5);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (snapshots.length - 1));
      const s   = snapshots[idx];
      ctx.fillText(
        `${Math.round(s.elapsedSeconds)}s`,
        xOf(s.elapsedSeconds),
        PAD_T + chartH + 6,
      );
    }
  }, [snapshots, prevAvgWpm]);

  if (snapshots.length < 2) {
    return (
      <div className="sr-chart-empty">
        not enough data — session was too short
      </div>
    );
  }

  return <canvas ref={canvasRef} className="sr-wpm-canvas" />;
};

/* ── Key grid ─────────────────────────────────────────────────────────── */

const KeyGrid: React.FC<{ keyStats: KeyStat[]; highlightWeak: boolean }> = ({
  keyStats,
  highlightWeak,
}) => {
  const ROWS = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l',';'],
    ['z','x','c','v','b','n','m',',','.'],
  ];

  const statMap = new Map(keyStats.map(k => [k.key, k]));

  function keyClass(key: string): string {
    const stat = statMap.get(key);
    if (!stat || stat.attempts < 2) return '';
    if (stat.accuracy >= 95) return 'sr-key--strong';
    if (stat.accuracy < 80)  return 'sr-key--weak';
    return 'sr-key--mid';
  }

  return (
    <div className="sr-key-grid" aria-label="Key accuracy grid">
      {ROWS.map((row, ri) => (
        <div key={ri} className="sr-key-row">
          {row.map(key => {
            const stat = statMap.get(key);
            return (
              <div
                key={key}
                className={`sr-key ${keyClass(key)}`}
                title={stat ? `${formatKeyLabel(key)}: ${stat.accuracy}% (${stat.attempts} presses)` : formatKeyLabel(key)}
              >
                {formatKeyLabel(key)}
                {stat && stat.attempts >= 2 && (
                  <div className="sr-key-acc">{stat.accuracy}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ── Verdict generator ────────────────────────────────────────────────── */

function getVerdict(report: SessionReport): { headline: string; detail: string } {
  const { wpm, accuracy, consistency, weakKeys, slowKeys, isPersonalBest, prevAvgWpm } = report;

  if (isPersonalBest) {
    return {
      headline: 'Personal best.',
      detail:   accuracy >= 95
        ? 'Clean and fast. That\'s the combination that compounds.'
        : `Speed is there — bring accuracy up from ${accuracy}% and it sticks.`,
    };
  }

  if (accuracy < 88) {
    return {
      headline: 'Slow down a little.',
      detail: `You're pressing keys before your fingers are sure. ${accuracy}% accuracy means roughly 1 in ${Math.round(100 / (100 - accuracy))} keystrokes is wrong — that's a habit worth breaking now.`,
    };
  }

  if (consistency < 65) {
    return {
      headline: 'Speed is uneven.',
      detail: `Your WPM varied a lot through the session. This usually means you're fast on familiar keys and hesitating on others. The weak ones are: ${weakKeys.slice(0, 3).map(formatKeyLabel).join(', ') || 'scattered'}.`,
    };
  }

  if (slowKeys.length > 0) {
    return {
      headline: 'Watch the hesitation.',
      detail: `You're accurate but pausing on: ${slowKeys.slice(0, 4).map(formatKeyLabel).join(', ')}. That pause is the muscle memory not quite landing yet. Drill those keys specifically.`,
    };
  }

  if (prevAvgWpm && wpm < prevAvgWpm - 5) {
    return {
      headline: 'Below your average.',
      detail: `You\'re capable of more — ${prevAvgWpm} wpm on average. Might have been a cold start. One more run?`,
    };
  }

  return {
    headline: 'Solid session.',
    detail: `${accuracy}% accuracy at ${wpm} wpm. ${consistency >= 80 ? 'Consistent too — that\'s the goal.' : 'Work on keeping the pace even throughout.'}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════ */

export const SessionReportCard: React.FC<SessionReportProps> = ({
  report,
  onRetry,
  onNextLesson,
  onHome,
}) => {
  const verdict = getVerdict(report);

  const wpmDelta = report.prevAvgWpm != null
    ? report.wpm - report.prevAvgWpm
    : null;

  return (
    <div className="sr-root">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="sr-header">
        <div className="sr-header__left">
          <div className="mono-label sr-header__eyebrow">
            session complete · {formatDuration(report.durationSeconds)}
          </div>
          <h2 className="sr-header__verdict">{verdict.headline}</h2>
          <p className="sr-header__detail">{verdict.detail}</p>
        </div>
        {report.isPersonalBest && (
          <div className="sr-pb-badge">new best</div>
        )}
      </div>

      {/* ── Headline stats row ──────────────────────────────────── */}
      <div className="sr-stats-row">
        <div className="sr-stat sr-stat--primary">
          <div className="sr-stat__label mono-label">wpm</div>
          <div className="sr-stat__value">{report.wpm}</div>
          {wpmDelta !== null && (
            <div className={`sr-stat__delta${wpmDelta >= 0 ? ' sr-stat__delta--up' : ' sr-stat__delta--down'}`}>
              {wpmDelta >= 0 ? '+' : ''}{wpmDelta} vs avg
            </div>
          )}
        </div>

        <div className="sr-stat">
          <div className="sr-stat__label mono-label">accuracy</div>
          <div
            className="sr-stat__value"
            style={{ color: gradeColor(report.accuracy) }}
          >
            {report.accuracy}<span className="sr-stat__unit">%</span>
          </div>
          <div className="sr-stat__sub">{report.correctChars} correct · {report.errorChars} errors</div>
        </div>

        <div className="sr-stat">
          <div className="sr-stat__label mono-label">consistency</div>
          <div className="sr-stat__value">
            {report.consistency}<span className="sr-stat__unit">%</span>
          </div>
          <div className="sr-stat__sub">{consistencyLabel(report.consistency)}</div>
        </div>

        <div className="sr-stat">
          <div className="sr-stat__label mono-label">raw wpm</div>
          <div className="sr-stat__value sr-stat__value--muted">{report.rawWpm}</div>
          <div className="sr-stat__sub">incl. corrections</div>
        </div>
      </div>

      {/* ── Chart + key analysis side by side ───────────────────── */}
      <div className="sr-lower">
        {/* Left: WPM trend */}
        <div className="sr-chart-section">
          <div className="mono-label sr-section-label">speed over time</div>
          <div className="sr-chart-wrap">
            <WpmChart
              snapshots={report.wpmSnapshots}
              prevAvgWpm={report.prevAvgWpm}
            />
          </div>
        </div>

        {/* Right: key breakdown */}
        <div className="sr-keys-section">
          <div className="mono-label sr-section-label">key accuracy</div>
          <KeyGrid keyStats={report.keyStats} highlightWeak={true} />

          <div className="sr-key-legend">
            <div className="sr-key-legend-item">
              <div className="sr-key-legend-swatch sr-key-legend-swatch--strong" />
              <span>≥ 95%</span>
            </div>
            <div className="sr-key-legend-item">
              <div className="sr-key-legend-swatch sr-key-legend-swatch--mid" />
              <span>80–94%</span>
            </div>
            <div className="sr-key-legend-item">
              <div className="sr-key-legend-swatch sr-key-legend-swatch--weak" />
              <span>below 80%</span>
            </div>
          </div>

          {/* Specific callouts */}
          {report.weakKeys.length > 0 && (
            <div className="sr-key-callout sr-key-callout--weak">
              <span className="mono-label">needs work:</span>
              {report.weakKeys.slice(0, 6).map(k => (
                <span key={k} className="sr-key-chip sr-key-chip--weak">{formatKeyLabel(k)}</span>
              ))}
            </div>
          )}

          {report.slowKeys.length > 0 && (
            <div className="sr-key-callout sr-key-callout--slow">
              <span className="mono-label">hesitation:</span>
              {report.slowKeys.slice(0, 4).map(k => (
                <span key={k} className="sr-key-chip sr-key-chip--slow">{formatKeyLabel(k)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="sr-actions">
        <button className="sr-action sr-action--ghost" onClick={onHome}>
          home
        </button>
        <button className="sr-action sr-action--ghost" onClick={onRetry}>
          retry →
        </button>
        {onNextLesson && (
          <button className="sr-action sr-action--primary" onClick={onNextLesson}>
            next lesson →
          </button>
        )}
      </div>
    </div>
  );
};

export default SessionReportCard;
