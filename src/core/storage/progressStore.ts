import { getLS, setLS } from "./localStorage";

export type PracticeAttempt = {
  wpm: number;
  accuracy: number;
  date: string;
};

export type PracticeProgress = {
  completed: number[];
  attempts: Record<number, PracticeAttempt[]>;
};

export function getPracticeProgress(): PracticeProgress {
  return getLS("kt_practice", {
    completed: [],
    attempts: {},
  });
}

export function savePracticeResult(lessonId: number, result: PracticeAttempt): PracticeProgress {
  const progress = getPracticeProgress();
  if (!progress.attempts[lessonId]) progress.attempts[lessonId] = [];
  progress.attempts[lessonId].unshift({ ...result, date: new Date().toISOString() });
  progress.attempts[lessonId] = progress.attempts[lessonId].slice(0, 10);

  if (result.accuracy >= 90 && !progress.completed.includes(lessonId)) {
    progress.completed.push(lessonId);
  }
  setLS("kt_practice", progress);
  return progress;
}
