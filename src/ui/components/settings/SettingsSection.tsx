import type { ReactNode } from "react";
import "./SettingsSection.css";

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-section-content">{children}</div>
    </div>
  );
}
