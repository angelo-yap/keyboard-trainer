/**
 * Finger mapping for touch typing.
 * 0=L-pinky, 1=L-ring, 2=L-middle, 3=L-index, 4=R-index, 5=R-middle, 6=R-ring, 7=R-pinky
 */
export const FINGER_MAP: Record<string, number> = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  y: 4, h: 4, n: 4, u: 4, j: 4,
  i: 5, k: 5, m: 5,
  o: 6, l: 6, ",": 6,
  p: 7, ";": 7, ".": 7, "'": 7,
  /* space: thumb — handled specially in lessonGuidance */
};

export const FINGER_NAMES = [
  "Left Pinky", "Left Ring", "Left Middle", "Left Index",
  "Right Index", "Right Middle", "Right Ring", "Right Pinky",
];

export const FINGER_COLORS = [
  "#e07b54", "#e09a54", "#c8c45a", "#7ec87e",
  "#7ec8a8", "#5a9ec8", "#7a8ec8", "#9a7ec8",
];

/** Softer colors for keyboard finger hints — minimal, not distracting */
export const FINGER_COLORS_SOFT = [
  "rgba(160, 120, 100, 0.12)",
  "rgba(160, 140, 100, 0.12)",
  "rgba(140, 150, 100, 0.12)",
  "rgba(100, 150, 120, 0.12)",
  "rgba(100, 150, 140, 0.12)",
  "rgba(100, 140, 160, 0.12)",
  "rgba(120, 130, 160, 0.12)",
  "rgba(140, 120, 160, 0.12)",
];
