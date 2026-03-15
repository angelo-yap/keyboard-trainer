import { LessonShell } from "../ui/layout/LessonShell";
import { AppLayout } from "../ui/layout/AppLayout";

export function FreeType() {
  return (
    <AppLayout>
      <LessonShell title="Free Type">
        <p>Type freely. Real-time feedback and tracking will appear here.</p>
      </LessonShell>
    </AppLayout>
  );
}
