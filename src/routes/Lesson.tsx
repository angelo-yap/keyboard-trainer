import { useParams } from "react-router-dom";
import { LessonShell } from "../ui/layout/LessonShell";
import { AppLayout } from "../ui/layout/AppLayout";

const LESSON_NAMES: Record<string, string> = {
  calibration: "Calibration",
  fundamentals: "Fundamentals",
  "habit-fix": "Habit Fix",
};

export function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const title = lessonId ? LESSON_NAMES[lessonId] ?? lessonId : "Lesson";

  return (
    <AppLayout>
      <LessonShell title={title}>
        <p>Lesson content placeholder. Lesson logic will be wired here.</p>
      </LessonShell>
    </AppLayout>
  );
}
