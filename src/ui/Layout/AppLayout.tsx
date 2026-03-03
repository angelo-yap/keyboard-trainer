import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./AppLayout.css";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <nav className="app-layout-nav">
        <Link to="/" className="app-layout-back">
          ← Back to Home
        </Link>
      </nav>
      <div className="app-layout-content">{children}</div>
    </div>
  );
}
