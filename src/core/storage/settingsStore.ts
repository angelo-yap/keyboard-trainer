import { getLS, setLS } from "./localStorage";

export type KeyboardLayoutType = "mac" | "windows";
export type KeyboardLightingMode = "solid" | "fingerBounds";

export type Settings = {
  testDuration: number;
  quotesModeEnabled: boolean;
  codeModeEnabled: boolean;
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
  keyboardLightingMode: KeyboardLightingMode;
  keyboardBacklightColor: string;
  keyboardLitKeyColor: string;
  handTrackingEnabled: boolean;
  handTrackerCameraIndex: number;
  handTrackerFlipHandedness: boolean;
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

function normalizeLightingMode(value: unknown, fallback: KeyboardLightingMode): KeyboardLightingMode {
  return value === "solid" || value === "fingerBounds" ? value : fallback;
}

const DEFAULT_SETTINGS: Settings = {
  testDuration: 60,
  quotesModeEnabled: true,
  codeModeEnabled: true,
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
  keyboardLightingMode: "solid",
  keyboardBacklightColor: "#861313",
  keyboardLitKeyColor: "#99EBFF",
  handTrackingEnabled: true,
  handTrackerCameraIndex: 0,
  handTrackerFlipHandedness: false,
};

export function getSettings(): Settings {
  const raw = getLS("kt_settings", {}) as Partial<Settings>;
  const savedSettings = { ...raw } as Partial<Settings> & {
    caseMode?: unknown;
  };
  delete savedSettings.caseMode;
  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    keyboardBacklightColor: normalizeHexColor(raw.keyboardBacklightColor, DEFAULT_SETTINGS.keyboardBacklightColor),
    keyboardLitKeyColor: normalizeHexColor(raw.keyboardLitKeyColor, DEFAULT_SETTINGS.keyboardLitKeyColor),
    keyboardLightingMode: normalizeLightingMode(raw.keyboardLightingMode, DEFAULT_SETTINGS.keyboardLightingMode),
    handTrackerCameraIndex: normalizeCameraIndex(raw.handTrackerCameraIndex, DEFAULT_SETTINGS.handTrackerCameraIndex),
  };
}

export function saveSettings(partial: Partial<Settings>): void {
  const current = getSettings();
  setLS("kt_settings", { ...current, ...partial });
}
