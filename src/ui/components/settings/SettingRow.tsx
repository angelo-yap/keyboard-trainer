import type { ReactNode } from "react";
import "./SettingRow.css";

type SettingRowProps = {
  label: string;
  desc?: string;
  children: ReactNode;
};

export function SettingRow({ label, desc, children }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-label">
        <div className="setting-row-name">{label}</div>
        {desc && <div className="setting-row-desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}
