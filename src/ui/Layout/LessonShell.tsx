import type { ReactNode } from "react";
import { KeyboardView } from "../components/KeyboardView";
import { CameraPanel } from "../components/CameraPanel";
import { FeedbackBanner } from "../components/FeedbackBanner";
import { TrackingStatus } from "../components/TrackingStatus";
import "./LessonShell.css";

interface LessonShellProps {
  children: ReactNode;
  title?: string;
}

export function LessonShell({ children, title }: LessonShellProps) {
  return (
    <div className="lesson-shell">
      <div className="lesson-shell-main">
        <section className="lesson-shell-left">
          <div className="lesson-shell-keyboard">
            <KeyboardView />
          </div>
          <div className="lesson-shell-prompt">
            {title && <h2 className="lesson-shell-title">{title}</h2>}
            {children}
          </div>
        </section>

        <section className="lesson-shell-right">
          <CameraPanel />
          <TrackingStatus />
        </section>
      </div>

      <footer className="lesson-shell-footer">
        <FeedbackBanner />
      </footer>
    </div>
  );
}
