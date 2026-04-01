import { useEffect, useMemo, useRef, useState } from "react";
import { getSettings, saveSettings, type Settings as SettingsType } from "../core/storage/settingsStore";
import { clearAllData } from "../core/storage/clearData";
import { getLastKeyboardLedEvent, resetKeyboardLed, sendKeyboardLedForKey, subscribeKeyboardLedDebug, syncKeyboardBacklightPreference, type KeyboardLedDebugEvent } from "../core/keyboard/keyboardLedBridge";
import { Keyboard } from "../ui/components/keyboard";
import { Button } from "../ui/components/Button";
import { SettingsSection } from "../ui/components/settings/SettingsSection";
import { SettingRow } from "../ui/components/settings/SettingRow";
import { Toggle } from "../ui/components/settings/Toggle";
import { SegmentControl } from "../ui/components/settings/SegmentControl";
import "./Settings.css";

type SettingsProps = {
  onBack: () => void;
  onSettingsChange?: () => void;
};

export function Settings({ onBack, onSettingsChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsType>(getSettings);
  const [cleared, setCleared] = useState(false);
  const [view, setView] = useState<"general" | "hid">("general");
  const [lastClickedKey, setLastClickedKey] = useState<string>("-");
  const [typedTestLetter, setTypedTestLetter] = useState<string>("");
  const [unsupportedKey, setUnsupportedKey] = useState<string>("");
  const [ledDebug, setLedDebug] = useState<KeyboardLedDebugEvent | null>(() => getLastKeyboardLedEvent());
  const previousViewRef = useRef<"general" | "hid">(view);

  const alphabet = useMemo(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), []);
  const specialTestKeys = useMemo(
    () => [
      { label: "Tab", value: "Tab" },
      { label: "Caps", value: "CapsLock" },
      { label: "Enter", value: "Enter" },
      { label: "Shift", value: "Shift" },
      { label: "Backspace", value: "Backspace" },
      { label: "Space", value: " " },
    ],
    [],
  );

  const lightingKeys = new Set<keyof SettingsType>([
    "keyboardBacklightColor",
    "keyboardLitKeyColor",
    "keyboardBacklightOff",
    "keyboardLitKeyOff",
  ]);

  const resetLightingDefaults = () => {
    const next = {
      ...settings,
      keyboardBacklightOff: false,
      keyboardLitKeyOff: false,
      keyboardBacklightColor: "#FF0000",
      keyboardLitKeyColor: "#FFFFFF",
    };
    setSettings(next);
    saveSettings(next);
    void syncKeyboardBacklightPreference();
    void resetKeyboardLed();
    onSettingsChange?.();
  };

  const update = <K extends keyof SettingsType>(key: K, val: SettingsType[K]) => {
    const next = { ...settings, [key]: val };
    if (key === "keyboardBacklightOff" && Boolean(val)) {
      next.keyboardLitKeyOff = true;
    }
    if (key === "keyboardLitKeyOff" && settings.keyboardBacklightOff && val === false) {
      next.keyboardLitKeyOff = true;
    }
    setSettings(next);
    saveSettings(next);
    if (key === "keyboardBacklightColor") {
      void syncKeyboardBacklightPreference();
    }
    if (lightingKeys.has(key)) {
      void resetKeyboardLed();
    }
    onSettingsChange?.();
  };

  const handleClearData = () => {
    if (window.confirm("Clear ALL data? This cannot be undone.")) {
      clearAllData();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    }
  };

  const handleHidTestKey = async (key: string) => {
    const printable = key.length === 1 ? key.toUpperCase() : key;
    setLastClickedKey(printable);
    setUnsupportedKey("");

    const response = await sendKeyboardLedForKey(key);
    if (response === null) {
      setUnsupportedKey(printable);
    }
  };

  const handleHidReset = async () => {
    setUnsupportedKey("");
    setLastClickedKey("RESET");
    await resetKeyboardLed();
  };

  const handleTypedLetterInput = async (value: string) => {
    const next = value.slice(-1);
    setTypedTestLetter(next);

    if (next.length === 1) {
      await handleHidTestKey(next);
      setTypedTestLetter("");
      return;
    }

    if (next.length > 0) {
      setUnsupportedKey(next);
    }
  };

  useEffect(() => {
    return subscribeKeyboardLedDebug((event) => {
      setLedDebug(event);
    });
  }, []);

  useEffect(() => {
    const previousView = previousViewRef.current;
    if (previousView === "hid" && view !== "hid") {
      setTypedTestLetter("");
      setUnsupportedKey("");
      setLastClickedKey("-");
      void resetKeyboardLed();
    }
    previousViewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      void resetKeyboardLed();
    };
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <div className="settings-title">Settings</div>
      </div>

      <div className="settings-view-switch">
        <button
          type="button"
          className={`settings-view-btn ${view === "general" ? "active" : ""}`}
          onClick={() => setView("general")}
        >
          General
        </button>
        <button
          type="button"
          className={`settings-view-btn ${view === "hid" ? "active" : ""}`}
          onClick={() => setView("hid")}
        >
          HID Debug
        </button>
      </div>

      {view === "hid" ? (
        <>
          <SettingsSection title="Keyboard LED Debug">
            <div className="settings-debug-summary">
              <div className="settings-debug-row">
                <span className="settings-debug-label">Last clicked</span>
                <span className="settings-debug-value">{lastClickedKey}</span>
              </div>
              <div className="settings-debug-row">
                <span className="settings-debug-label">Status</span>
                <span className={`settings-debug-value ${ledDebug?.response.ok ? "ok" : "err"}`}>
                  {ledDebug ? (ledDebug.response.ok ? "ok" : "error") : "idle"}
                </span>
              </div>
              <div className="settings-debug-row">
                <span className="settings-debug-label">Transport</span>
                <span className="settings-debug-value">{ledDebug?.response.transport?.transport ?? "-"}</span>
              </div>
              <div className="settings-debug-row">
                <span className="settings-debug-label">Forced mode</span>
                <span className="settings-debug-value">{String(ledDebug?.response.transport?.forcedMode ?? "-")}</span>
              </div>
              <div className="settings-debug-row">
                <span className="settings-debug-label">LED index</span>
                <span className="settings-debug-value">{String(ledDebug?.response.transport?.ledIndex ?? "-")}</span>
              </div>
              {ledDebug?.response.error && (
                <div className="settings-debug-error">{ledDebug.response.error}</div>
              )}
              {unsupportedKey && (
                <div className="settings-debug-note">
                  Key {unsupportedKey} is not mapped yet. Supported: A-Z, 0-9, symbols (`-=[]\;',./), and Backspace/Tab/CapsLock/Enter/Shift/Space.
                </div>
              )}
              <div className="settings-debug-actions">
                <button
                  type="button"
                  className="settings-debug-reset-btn"
                  onClick={() => {
                    void handleHidReset();
                  }}
                >
                  Reset Keyboard Lighting
                </button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Click To Test">
            <div className="settings-debug-special-wrap">
              <div className="settings-debug-input-label">Press A Special-Key Button</div>
              <div className="settings-debug-special-grid">
                {specialTestKeys.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="settings-debug-special-btn"
                    onClick={() => {
                      void handleHidTestKey(item.value);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-debug-input-wrap">
              <label htmlFor="hid-letter-input" className="settings-debug-input-label">
                Type A Key To Light It Instantly
              </label>
              <input
                id="hid-letter-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={1}
                className="settings-debug-input"
                value={typedTestLetter}
                onChange={(event) => {
                  void handleTypedLetterInput(event.target.value);
                }}
                placeholder="A-Z / 0-9 / symbols"
              />
            </div>

            <div className="settings-debug-keyboard-wrap">
              <Keyboard
                layoutType={settings.keyboardLayout ?? "mac"}
                showFingerHints={false}
                mode="test"
                onKeyClick={(key) => {
                  void handleHidTestKey(key);
                }}
              />
            </div>

            <div className="settings-debug-alpha-grid">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className="settings-debug-alpha-btn"
                  onClick={() => {
                    void handleHidTestKey(letter);
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
          </SettingsSection>
        </>
      ) : (
        <>

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
              desc="Show keyboard while typing. Ctrl+K or Cmd+K to toggle."
            >
              <Toggle
                value={settings.showKeyboard}
                onChange={(v) => update("showKeyboard", v)}
              />
            </SettingRow>
            <SettingRow
              label="Keyboard Layout"
              desc="Mac or Windows bottom row"
            >
              <SegmentControl
                options={[
                  ["mac", "Mac"],
                  ["windows", "Windows"],
                ]}
                value={settings.keyboardLayout ?? "mac"}
                onChange={(v) => update("keyboardLayout", v as SettingsType["keyboardLayout"])}
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
                onChange={(v) => update("fontSize", v as SettingsType["fontSize"])}
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
                onChange={(v) => update("caretStyle", v as SettingsType["caretStyle"])}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Keyboard Lighting">
            <SettingRow
              label="Backlight Off"
              desc="Turn off base backlight regardless of selected color"
            >
              <Toggle
                value={settings.keyboardBacklightOff}
                onChange={(v) => update("keyboardBacklightOff", v)}
              />
            </SettingRow>

            <SettingRow
              label="Backlight Color"
              desc="Base color applied to all keys before highlighting the typed key"
            >
              <label className="settings-color-input-wrap" aria-label="Backlight Color">
                <input
                  type="color"
                  className="settings-color-input"
                  value={settings.keyboardBacklightColor}
                  disabled={settings.keyboardBacklightOff}
                  onChange={(e) => update("keyboardBacklightColor", e.target.value.toUpperCase())}
                />
                <span className="settings-color-code">{settings.keyboardBacklightColor}</span>
              </label>
            </SettingRow>

            <SettingRow
              label="Lit Key Off"
              desc={
                settings.keyboardBacklightOff
                  ? "Forced on while Backlight Off is enabled"
                  : "Turn off typed-key highlight regardless of selected color"
              }
            >
              <Toggle
                value={settings.keyboardLitKeyOff}
                onChange={(v) => update("keyboardLitKeyOff", v)}
              />
            </SettingRow>

            <SettingRow
              label="Lit Key Color"
              desc="Color used for the key you just typed"
            >
              <label className="settings-color-input-wrap" aria-label="Lit Key Color">
                <input
                  type="color"
                  className="settings-color-input"
                  value={settings.keyboardLitKeyColor}
                  disabled={settings.keyboardLitKeyOff || settings.keyboardBacklightOff}
                  onChange={(e) => update("keyboardLitKeyColor", e.target.value.toUpperCase())}
                />
                <span className="settings-color-code">{settings.keyboardLitKeyColor}</span>
              </label>
            </SettingRow>

            <div className="settings-lighting-note">
                &emsp;Not all RGB colors are fully available on every keyboard.
            </div>

            <div className="settings-lighting-actions">
              <button
                type="button"
                className="settings-reset-lighting-btn"
                onClick={resetLightingDefaults}
              >
                Reset lighting defaults
              </button>
            </div>
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
        </>
      )}
    </div>
  );
}
