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
  keyboardBacklightOff: boolean;
  keyboardLitKeyOff: boolean;
  keyboardBacklightColor: string;
  keyboardLitKeyColor: string;
};

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

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
  keyboardBacklightOff: false,
  keyboardLitKeyOff: false,
  keyboardBacklightColor: "#FF0000",
  keyboardLitKeyColor: "#FFFFFF",
};

export function getSettings(): Settings {
  const raw = getLS("kt_settings", {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    keyboardBacklightColor: normalizeHexColor(raw.keyboardBacklightColor, DEFAULT_SETTINGS.keyboardBacklightColor),
    keyboardLitKeyColor: normalizeHexColor(raw.keyboardLitKeyColor, DEFAULT_SETTINGS.keyboardLitKeyColor),
  };
}

export function saveSettings(partial: Partial<Settings>): void {
  const current = getSettings();
  setLS("kt_settings", { ...current, ...partial });
}
