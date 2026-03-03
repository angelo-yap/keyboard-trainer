import { useState } from "react";
import { useTyping } from "../hooks/useTyping";
import { getPracticeProgress, savePracticeResult } from "../core/storage/progressStore";
import { PRACTICE_LESSONS } from "../core/lesson/lessons/practiceLessons";
import { FINGER_MAP, FINGER_NAMES, FINGER_COLORS } from "../core/keyboard/fingerMap";
import { KeyboardVisual } from "../ui/components/KeyboardVisual";
import { TypingDisplay } from "../ui/components/TypingDisplay";
import { StatBar } from "../ui/components/StatBar";
import { ResultsCard } from "../ui/components/ResultsCard";
import { Button } from "../ui/components/Button";
import type { Settings } from "../core/storage/settingsStore";
import "./Practice.css";

type PracticeProps = {
  onBack: () => void;
  settings: Settings;
};

function buildText(lesson: (typeof PRACTICE_LESSONS)[0]): string {
  const base = lesson.text;
  let result = "";
  while (result.replace(/\s+$/, "").length < 150) {
    result += base + " ";
  }
  return result.trim().slice(0, 220);
}

export function Practice({ onBack, settings }: PracticeProps) {
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [result, setResult] = useState<{ wpm: number; accuracy: number; rawWpm?: number; errors: number; chars: number; elapsed?: number } | null>(null);
  const progress = getPracticeProgress();

  const lesson = PRACTICE_LESSONS.find((l) => l.id === lessonId);

  if (!lessonId) {
    return (
      <LessonSelect
        onSelect={setLessonId}
        onBack={onBack}
        progress={progress}
      />
    );
  }
  if (result) {
    return (
      <ResultsCard
        result={result}
        title={result.accuracy >= 90 ? "✅ Lesson Complete!" : "Keep Going!"}
        onRetry={() => setResult(null)}
        onBack={() => {
          setResult(null);
          setLessonId(null);
        }}
        onNext={() => {
          const nextLesson = PRACTICE_LESSONS.find((l) => l.id === lessonId + 1);
          if (nextLesson) {
            setResult(null);
            setLessonId(nextLesson.id);
          } else {
            setResult(null);
            setLessonId(null);
          }
        }}
        nextLabel="Next Lesson →"
        showNext={PRACTICE_LESSONS.some((l) => l.id === lessonId + 1)}
      />
    );
  }

  return (
    <LessonTyping
      lesson={lesson!}
      settings={settings}
      onComplete={(res) => {
        savePracticeResult(lesson!.id, res);
        setResult(res);
      }}
      onBack={() => setLessonId(null)}
    />
  );
}

function LessonSelect({
  onSelect,
  onBack,
  progress,
}: {
  onSelect: (id: number) => void;
  onBack: () => void;
  progress: { completed: number[]; attempts: Record<number, { wpm: number; accuracy: number; date: string }[]> };
}) {
  return (
    <div className="practice-select">
      <div className="practice-select-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div>
          <div className="practice-select-title">Practice Lessons</div>
          <div className="practice-select-subtitle">
            {progress.completed.length} / {PRACTICE_LESSONS.length} completed · Reach 90% accuracy to unlock next
          </div>
        </div>
      </div>

      <div className="practice-lesson-grid">
        {PRACTICE_LESSONS.map((lesson, i) => {
          const done = progress.completed.includes(lesson.id);
          const locked = i > 0 && !progress.completed.includes(PRACTICE_LESSONS[i - 1].id);
          const attempts = progress.attempts[lesson.id] || [];
          const bestAcc = attempts.length ? Math.max(...attempts.map((a) => a.accuracy)) : null;
          const bestWpm = attempts.length ? Math.max(...attempts.map((a) => a.wpm)) : null;

          return (
            <div
              key={lesson.id}
              onClick={() => !locked && onSelect(lesson.id)}
              className={`practice-lesson-card ${done ? "done" : ""} ${locked ? "locked" : ""}`}
            >
              <div className="practice-lesson-header">
                <span className="practice-lesson-icon">
                  {done ? "✅" : locked ? "🔒" : "▶"}
                </span>
                <div>
                  <div className="practice-lesson-name">
                    <span className="practice-lesson-num">#{lesson.id}</span>
                    {lesson.name}
                  </div>
                  <div className="practice-lesson-desc">{lesson.desc}</div>
                </div>
              </div>

              <div className="practice-lesson-keys">
                {lesson.keys.map((k) => (
                  <span key={k} className="practice-key-chip">
                    {k.toUpperCase()}
                  </span>
                ))}
              </div>

              {bestAcc !== null && (
                <div className="practice-lesson-stats">
                  <span className={bestAcc >= 90 ? "acc-good" : ""}>
                    Best acc: <strong>{bestAcc}%</strong>
                  </span>
                  <span>
                    Best WPM: <strong className="wpm-highlight">{bestWpm}</strong>
                  </span>
                  <span className="attempts">
                    {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonTyping({
  lesson,
  settings,
  onComplete,
  onBack,
}: {
  lesson: (typeof PRACTICE_LESSONS)[0];
  settings: Settings;
  onComplete: (res: { wpm: number; accuracy: number; rawWpm?: number; errors: number; chars: number; elapsed?: number }) => void;
  onBack: () => void;
}) {
  const [text] = useState(() => buildText(lesson));

  const typing = useTyping({
    text,
    enabled: true,
    onComplete,
  });

  const currentFingerIdx = typing.currentChar
    ? (FINGER_MAP[typing.currentChar.toLowerCase()] ?? null)
    : null;

  return (
    <div className="practice-typing">
      <div className="practice-typing-header">
        <Button variant="secondary" onClick={onBack}>
          ← Lessons
        </Button>
        <div className="practice-typing-info">
          <div className="practice-typing-name">{lesson.name}</div>
          <div className="practice-typing-hint">{lesson.hint}</div>
        </div>
        <div className="practice-focus-keys">
          {lesson.keys.map((k) => (
            <span
              key={k}
              className={`practice-focus-key ${typing.currentChar?.toLowerCase() === k ? "active" : ""}`}
            >
              {k.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {currentFingerIdx !== null && settings?.showFingerHints !== false && (
        <div
          className="practice-finger-hint"
          style={{
            background: `${FINGER_COLORS[currentFingerIdx]}18`,
            borderColor: `${FINGER_COLORS[currentFingerIdx]}45`,
          }}
        >
          <div
            className="practice-finger-dot"
            style={{ background: FINGER_COLORS[currentFingerIdx] }}
          />
          <span>
            Use your{" "}
            <strong style={{ color: FINGER_COLORS[currentFingerIdx] }}>
              {FINGER_NAMES[currentFingerIdx]}
            </strong>{" "}
            for this key
          </span>
          {typing.combo > 4 && (
            <span className="practice-combo">🔥 {typing.combo} combo</span>
          )}
        </div>
      )}

      <StatBar
        stats={typing.liveStats}
        extra={[
          {
            label: "Progress",
            value: Math.round(typing.progress * 100) + "%",
            color: "rgba(255,255,255,0.6)",
          },
        ]}
      />

      <div className="practice-progress-bar">
        <div
          className="practice-progress-fill"
          style={{ width: `${typing.progress * 100}%` }}
        />
      </div>

      <TypingDisplay
        text={text}
        typed={typing.typed}
        errors={typing.errors}
        fontSize={settings?.fontSize || "md"}
        caretStyle={settings?.caretStyle || "block"}
        onClick={typing.focus}
      />

      <input
        ref={typing.inputRef}
        onKeyDown={typing.handleKeyDown}
        className="practice-hidden-input"
        readOnly
      />

      {settings?.showKeyboard !== false && (
        <div className="practice-keyboard-wrap">
          <KeyboardVisual
            highlightChar={typing.currentChar}
            pressedKey={typing.pressedKey}
            showFingerColors={settings?.showFingerHints !== false}
          />
        </div>
      )}
    </div>
  );
}
