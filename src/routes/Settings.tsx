import { useState } from "react";
import { getSettings, saveSettings, type Settings as SettingsType } from "../core/storage/settingsStore";
import { clearAllData } from "../core/storage/clearData";
import { Button } from "../ui/components/Button";
import { SettingsSection } from "../ui/components/settings/SettingsSection";
import { SettingRow } from "../ui/components/settings/SettingRow";
import { Toggle } from "../ui/components/settings/Toggle";
import { SegmentControl } from "../ui/components/settings/SegmentControl";
import "./Settings.css";

type SettingsProps = {
  onBack: () => void;
};

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsType>(getSettings);
  const [cleared, setCleared] = useState(false);

  const update = (key: keyof SettingsType, val: SettingsType[keyof SettingsType]) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  };

  const handleClearData = () => {
    if (window.confirm("Clear ALL data? This cannot be undone.")) {
      clearAllData();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div className="settings-title">Settings</div>
      </div>

      <SettingsSection title="Test">
        <SettingRow label="Default Duration">
          <SegmentControl
            options={[
              [15, "15s"],
              [30, "30s"],
              [60, "60s"],
              [120, "2m"],
            ]}
            value={settings.testDuration}
            onChange={(v) => update("testDuration", v)}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Display">
        <SettingRow
          label="Show Keyboard"
          desc="Show keyboard visual while typing"
        >
          <Toggle
            value={settings.showKeyboard}
            onChange={(v) => update("showKeyboard", v)}
          />
        </SettingRow>
        <SettingRow
          label="Finger Hints"
          desc="Highlight which finger to use for each key"
        >
          <Toggle
            value={settings.showFingerHints}
            onChange={(v) => update("showFingerHints", v)}
          />
        </SettingRow>
        <SettingRow label="Font Size" desc="Size of typing text">
          <SegmentControl
            options={[
              ["sm", "Small"],
              ["md", "Medium"],
              ["lg", "Large"],
            ]}
            value={settings.fontSize}
            onChange={(v) => update("fontSize", v)}
          />
        </SettingRow>
        <SettingRow label="Caret Style">
          <SegmentControl
            options={[
              ["block", "Block"],
              ["line", "Line"],
              ["underline", "Under"],
            ]}
            value={settings.caretStyle}
            onChange={(v) => update("caretStyle", v)}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingRow
          label="Storage"
          desc="All data is stored locally in your browser. No account required."
        >
          <div className="settings-storage-badge">Local only</div>
        </SettingRow>
        <SettingRow
          label="Clear All Data"
          desc="Permanently delete all progress, settings, and history"
        >
          <button
            onClick={handleClearData}
            className={`settings-clear-btn ${cleared ? "cleared" : ""}`}
          >
            {cleared ? "✓ Cleared" : "Clear Data"}
          </button>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="About">
        <div className="settings-about">
          <div>KeyboardTrainer v1.0</div>
          <div>Built for learning correct touch typing with hardware feedback.</div>
          <div className="settings-about-note">
            Camera integration placeholder ready — connect MediaPipe Hands when
            hardware is available.
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
