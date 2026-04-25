import { getLS, setLS } from "./localStorage";

export type KeyboardLayoutType = "mac" | "windows";
export type CaseMode = "lowercase" | "uppercase" | "mixed";

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
  handTrackerCameraIndex: number;
  handTrackerFlipHandedness: boolean;
  caseMode: CaseMode;
};

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function normalizeCameraIndex(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return fallback;
}

function normalizeCaseMode(value: unknown, fallback: CaseMode): CaseMode {
  return value === "lowercase" || value === "uppercase" || value === "mixed"
    ? value
    : fallback;
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
  handTrackerCameraIndex: 0,
  handTrackerFlipHandedness: false,
  caseMode: "lowercase",
};

export function getSettings(): Settings {
  const raw = getLS("kt_settings", {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    keyboardBacklightColor: normalizeHexColor(raw.keyboardBacklightColor, DEFAULT_SETTINGS.keyboardBacklightColor),
    keyboardLitKeyColor: normalizeHexColor(raw.keyboardLitKeyColor, DEFAULT_SETTINGS.keyboardLitKeyColor),
    handTrackerCameraIndex: normalizeCameraIndex(raw.handTrackerCameraIndex, DEFAULT_SETTINGS.handTrackerCameraIndex),
    caseMode: normalizeCaseMode(raw.caseMode, DEFAULT_SETTINGS.caseMode),
  };
}

export function saveSettings(partial: Partial<Settings>): void {
  const current = getSettings();
  setLS("kt_settings", { ...current, ...partial });
}
