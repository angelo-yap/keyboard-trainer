import { getPracticeProgress } from "../storage/progressStore";
import { PRACTICE_LESSONS } from "./lessons/practiceLessons";

export type LessonSummary = {
  id: string;
  number: number;
  name: string;
  keys: string;
  status: "done" | "active" | "locked";
  bestWpm?: number;
};

export function getLessonSummaries(): LessonSummary[] {
  const progress = getPracticeProgress();
  const completed = new Set(progress.completed);

  return PRACTICE_LESSONS.map((lesson, i) => {
    const done = completed.has(lesson.id);
    const prevDone = i === 0 || completed.has(PRACTICE_LESSONS[i - 1].id);
    const locked = !prevDone;
    const active = prevDone && !done;

    const attempts = progress.attempts[lesson.id] || [];
    const bestWpm =
      attempts.length > 0
        ? Math.max(...attempts.map((a) => a.wpm))
        : undefined;

    return {
      id: String(lesson.id),
      number: lesson.id,
      name: lesson.name,
      keys: lesson.keys.map((k) => k.toUpperCase()).join(" "),
      status: done ? "done" : active ? "active" : "locked",
      bestWpm,
    };
  });
}
