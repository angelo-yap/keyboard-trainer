/* ─── src/routes/Home.tsx ────────────────────────────────────────────────────
   Home screen. Reads from your existing stores; emits onTabChange to navigate.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useMemo } from 'react';
import './Home.css';

/* ── Types mirroring what your stores already expose ─────────────────────
   Adjust field names if yours differ — the logic is trivial to adapt.     */

interface LessonSummary {
  id: string;
  number: number;
  name: string;
  keys: string;           /* e.g. "a s d f j k l ;" */
  status: 'done' | 'active' | 'locked';
  bestWpm?: number;
}

interface WeakKey {
  key: string;
  accuracy: number;       /* 0–100 */
}

/* Finger mastery state — maps to the hand diagram */
type FingerState = 'mastered' | 'learning' | 'weak' | 'unlocked';

interface FingerMastery {
  /* Left hand, pinky→index: L5 L4 L3 L2 */
  L5: FingerState; L4: FingerState; L3: FingerState; L2: FingerState;
  /* Right hand, index→pinky: R2 R3 R4 R5 */
  R2: FingerState; R3: FingerState; R4: FingerState; R5: FingerState;
}

interface HomeProps {
  /* Wire these up in App.tsx from your stores */
  lessons: LessonSummary[];
  weakKeys: WeakKey[];
  fingerMastery: FingerMastery;
  avgWpm: number;
  accuracy: number;
  wpmDelta: number;         /* change this week */
  accuracyDelta: number;
  dayLabel: string;         /* e.g. "day 7 — tuesday" */
  coachMessage: string;     /* contextual sentence from your logic */
  coachDetail: string;      /* follow-up sentence */
  onTabChange: (tab: 'learn' | 'practice' | 'test' | 'analytics' | 'settings') => void;
}

/* ── Sub-components ──────────────────────────────────────────────────── */

const MicroStat: React.FC<{
  label: string;
  value: number;
  unit: string;
  delta: number;
  deltaUnit?: string;
}> = ({ label, value, unit, delta, deltaUnit = '' }) => (
  <div className="home-micro-stat">
    <div className="home-micro-stat__label mono-label">{label}</div>
    <div className="home-micro-stat__value">
      {value}<span className="home-micro-stat__unit">{unit}</span>
    </div>
    {delta !== 0 && (
      <div className="home-micro-stat__delta">
        {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}{deltaUnit} this week
      </div>
    )}
  </div>
);

/* Finger column in the hand diagram */
const FingerCol: React.FC<{
  label: string;
  state: FingerState;
  keys: string;
  height: number;
}> = ({ label, state, keys, height }) => (
  <div className="hd-finger-col">
    <div
      className={`hd-finger-body hd-finger-body--${state}`}
      style={{ height }}
    >
      <div className="hd-finger-keys">{keys}</div>
    </div>
    <div className="hd-finger-label">{label}</div>
  </div>
);

/* Hand mastery diagram */
const HandDiagram: React.FC<{ mastery: FingerMastery }> = ({ mastery }) => (
  <div className="hd-root">
    <div className="hd-hand">
      <FingerCol label="L5" state={mastery.L5} keys={'a\nz\nq'} height={44} />
      <FingerCol label="L4" state={mastery.L4} keys={'s\nx\n2'} height={52} />
      <FingerCol label="L3" state={mastery.L3} keys={'d\nc\n3'} height={56} />
      <FingerCol label="L2" state={mastery.L2} keys={'f\nv\n4\nr'} height={62} />
      <div className="hd-finger-col">
        <div className="hd-thumb hd-thumb--left" />
        <div className="hd-finger-label">L1</div>
      </div>
    </div>

    <div className="hd-gap"><div className="hd-gap-line" /></div>

    <div className="hd-hand">
      <div className="hd-finger-col">
        <div className="hd-thumb hd-thumb--right" />
        <div className="hd-finger-label">R1</div>
      </div>
      <FingerCol label="R2" state={mastery.R2} keys={'j\nm\n7\nu'} height={62} />
      <FingerCol label="R3" state={mastery.R3} keys={'k\n,\n8\ni'} height={56} />
      <FingerCol label="R4" state={mastery.R4} keys={'l\n.\n9'}    height={52} />
      <FingerCol label="R5" state={mastery.R5} keys={';\n/\n0\np'} height={44} />
    </div>

    <div className="hd-legend">
      <LegendItem color="correct" label="solid" />
      <LegendItem color="accent"  label="learning" />
      <LegendItem color="error"   label="weak" />
      <LegendItem color="surface" label="not yet" />
    </div>
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="hd-legend-item">
    <div className={`hd-legend-dot hd-legend-dot--${color}`} />
    <span>{label}</span>
  </div>
);

/* Progress dot row */
const ProgressDots: React.FC<{ lessons: LessonSummary[] }> = ({ lessons }) => (
  <div className="home-progress-dots">
    {lessons.map(l => (
      <div
        key={l.id}
        className={`home-progress-dot home-progress-dot--${l.status}`}
        title={l.name}
      />
    ))}
  </div>
);

/* ── Main component ──────────────────────────────────────────────────── */

export const Home: React.FC<HomeProps> = ({
  lessons,
  weakKeys,
  fingerMastery,
  avgWpm,
  accuracy,
  wpmDelta,
  accuracyDelta,
  dayLabel,
  coachMessage,
  coachDetail,
  onTabChange,
}) => {
  const activeLesson = useMemo(() => lessons.find(l => l.status === 'active'), [lessons]);

  return (
    <div className="home-root">
      {/* ── Left column ─────────────────────────────────────────────── */}
      <div className="home-main">
        {/* Greeting */}
        <div className="home-greeting">
          <div className="home-greeting__eyebrow mono-label">{dayLabel}</div>
          <h1 className="home-greeting__headline">
            Good to have you<br />back,{' '}
            <em>keep going.</em>
          </h1>
          <p className="home-greeting__sub">{coachMessage}</p>
          {coachDetail && (
            <p className="home-greeting__sub home-greeting__sub--detail">{coachDetail}</p>
          )}
        </div>

        {/* Resume block */}
        {activeLesson && (
          <div className="home-resume">
            <div className="home-resume__left">
              <div className="home-resume__label mono-label">continue where you left off</div>
              <div className="home-resume__name">
                Lesson {activeLesson.number} —{' '}
                <em>{activeLesson.name.toLowerCase()}</em>
              </div>
              <div className="home-resume__meta">
                {activeLesson.keys}
                {activeLesson.bestWpm != null && (
                  <>&nbsp;·&nbsp; best {activeLesson.bestWpm} wpm</>
                )}
              </div>
              <ProgressDots lessons={lessons} />
            </div>
            <button
              className="home-resume__btn"
              onClick={() => onTabChange('practice')}
            >
              begin →
            </button>
          </div>
        )}

        {/* Lesson list */}
        <div className="home-lessons">
          <div className="mono-label home-section-label">all lessons</div>
          <div className="home-lesson-list">
            {lessons.map(lesson => (
              <div
                key={lesson.id}
                className={`home-lesson-row home-lesson-row--${lesson.status}`}
                onClick={() => lesson.status !== 'locked' && onTabChange('learn')}
              >
                <span className="home-lesson-row__num">
                  {lesson.status === 'done' ? '✓' : lesson.number}
                </span>
                <span className="home-lesson-row__name">{lesson.name}</span>
                <span className="home-lesson-row__keys">{lesson.keys}</span>
                <span className={`home-lesson-row__score${lesson.bestWpm == null ? ' home-lesson-row__score--empty' : ''}`}>
                  {lesson.bestWpm != null ? `${lesson.bestWpm} wpm` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right column ────────────────────────────────────────────── */}
      <div className="home-aside">
        {/* Micro stats */}
        <div className="home-micro-stats">
          <MicroStat label="avg speed" value={avgWpm}   unit=" wpm" delta={wpmDelta} />
          <MicroStat label="accuracy"  value={accuracy} unit="%"    delta={accuracyDelta} deltaUnit="%" />
        </div>

        {/* Hand diagram */}
        <div className="home-hand-section">
          <div className="mono-label home-section-label">your hands — key mastery</div>
          <HandDiagram mastery={fingerMastery} />
        </div>

        {/* Weak keys */}
        {weakKeys.length > 0 && (
          <div className="home-weak-keys">
            <div className="mono-label home-section-label">keys needing work</div>
            <div className="home-weak-list">
              {weakKeys.slice(0, 5).map(wk => (
                <div key={wk.key} className="home-weak-row">
                  <span className="home-weak-row__key">{wk.key}</span>
                  <div className="home-weak-row__track">
                    <div
                      className="home-weak-row__fill"
                      style={{ width: `${wk.accuracy}%` }}
                    />
                  </div>
                  <span className="home-weak-row__pct">{wk.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
