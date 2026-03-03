import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Panel({ children, title, className = "" }: PanelProps) {
  return (
    <div className={`panel ${className}`.trim()}>
      {title && <h3 className="panel-title">{title}</h3>}
      {children}
    </div>
  );
}
