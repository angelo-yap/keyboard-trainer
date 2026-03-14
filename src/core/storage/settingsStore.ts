import { getLS, setLS } from "./localStorage";

export type KeyboardLayoutType = "mac" | "windows";

export type Settings = {
  testDuration: number;
  wordCount: number;
  testMode: "time" | "words";
  showKeyboard: boolean;
  showFingerHints: boolean;
  keyboardLayout: KeyboardLayoutType;
  soundEnabled: boolean;
  caretStyle: "block" | "line" | "underline";
  smoothCaret: boolean;
  fontSize: "sm" | "md" | "lg";
};

const DEFAULT_SETTINGS: Settings = {
  testDuration: 60,
  wordCount: 25,
  testMode: "time",
  showKeyboard: true,
  showFingerHints: true,
  keyboardLayout: "mac",
  soundEnabled: false,
  caretStyle: "block",
  smoothCaret: true,
  fontSize: "md",
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...getLS("kt_settings", {}) };
}

export function saveSettings(partial: Partial<Settings>): void {
  const current = getSettings();
  setLS("kt_settings", { ...current, ...partial });
}
