import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./ModeCard.css";

interface ModeCardProps {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  cta?: string;
}

export function ModeCard({
  to,
  icon,
  title,
  description,
  cta = "Start",
}: ModeCardProps) {
  return (
    <Link to={to} className="mode-card" tabIndex={0} role="listitem">
      <div className="mode-card-icon">{icon}</div>
      <h3 className="mode-card-title">{title}</h3>
      <p className="mode-card-description">{description}</p>
      <span className="mode-card-cta btn btn-primary btn-sm">{cta}</span>
    </Link>
  );
}
