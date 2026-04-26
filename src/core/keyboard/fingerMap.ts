/**
 * Finger mapping for touch typing.
 * 0=L-pinky, 1=L-ring, 2=L-middle, 3=L-index, 4=R-index, 5=R-middle, 6=R-ring, 7=R-pinky
 */
export const FINGER_MAP: Record<string, number> = {
  "`": 0, "1": 0, q: 0, a: 0, z: 0,
  "2": 1, w: 1, s: 1, x: 1,
  "3": 2, e: 2, d: 2, c: 2,
  "4": 3, "5": 3, r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  "6": 4, "7": 4, y: 4, h: 4, n: 4, u: 4, j: 4, m: 4,
  "8": 5, i: 5, k: 5, ",": 5,
  "9": 6, o: 6, l: 6, ".": 6,
  "0": 7, "-": 7, "=": 7, p: 7, "[": 7, "]": 7, "\\": 7, ";": 7, "'": 7, "/": 7,
  /* space: thumb — handled specially in lessonGuidance */
};

export const SPECIAL_FINGER_MAP: Record<string, number> = {
  Tab: 0,
  CapsLock: 0,
  ShiftLeft: 0,
  ControlLeft: 0,
  Backspace: 7,
  Enter: 7,
  ShiftRight: 7,
  ControlRight: 7,
};

export const FINGER_NAMES = [
  "Left Pinky", "Left Ring", "Left Middle", "Left Index",
  "Right Index", "Right Middle", "Right Ring", "Right Pinky",
];

export const FINGER_COLORS = [
  "#c864ff", "#508cff", "#ffc850", "#64ff78",
  "#64dc78", "#ffb450", "#3ca0ff", "#ff50b4",
];

/** Softer colors for keyboard finger hints — minimal, not distracting */
export const FINGER_COLORS_SOFT = [
  "rgba(200, 100, 255, 0.14)",
  "rgba(80, 140, 255, 0.14)",
  "rgba(255, 200, 80, 0.14)",
  "rgba(100, 255, 120, 0.14)",
  "rgba(45, 205, 225, 0.22)",
  "rgba(255, 180, 80, 0.14)",
  "rgba(60, 160, 255, 0.14)",
  "rgba(255, 80, 180, 0.14)",
];
