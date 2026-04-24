/**
 * Centralized lesson guidance: key → finger, hand, instruction.
 * Drives instruction bar text and hand/finger visualization.
 */

import { FINGER_MAP, FINGER_NAMES } from "./fingerMap";

export type Hand = "left" | "right" | "both";

export type FingerGuidance = {
  key: string;
  fingerName: string;
  hand: Hand;
  /** 0–3 = pinky→index (left) or index→pinky (right); -1 = thumb (both) */
  fingerIndex: number;
  tip: string;
  /** Optional override for primary instruction (e.g. space) */
  primaryInstruction?: string;
};

const TIPS: Record<string, string> = {
  p: "Keep your index finger resting on J as your anchor. Let the pinky extend — the reach is small but unfamiliar.",
  q: "Your left pinky needs to stretch up and left. Keep the other fingers hovering over home row.",
  b: "Both index fingers reach for B — use whichever hand feels natural but be consistent.",
};

const SPACE_GUIDANCE: FingerGuidance = {
  key: " ",
  fingerName: "thumb",
  hand: "both",
  fingerIndex: -1,
  tip: "Either thumb works. Keep your other fingers on home row.",
  primaryInstruction: "Use your thumb for Space",
};

/** Get hand for a key. */
export function getHandForKey(key: string): Hand | null {
  if (!key) return null;
  if (key === " ") return "both";
  const idx = FINGER_MAP[key.toLowerCase()];
  if (idx == null) return null;
  return idx < 4 ? "left" : "right";
}

/** Get finger index for HandCue: 0–4 per hand, -1 for thumb (both). */
export function getFingerIndexForKey(key: string): number {
  if (!key || key === " ") return -1;
  const idx = FINGER_MAP[key.toLowerCase()];
  if (idx == null) return -1;
  return idx < 4 ? idx : idx - 3;
}

/** Get full guidance for instruction bar and hand visual. Returns null only for unknown keys. */
export function getGuidanceForKey(key: string): FingerGuidance | null {
  if (!key) return null;
  if (key === " ") return SPACE_GUIDANCE;

  const idx = FINGER_MAP[key.toLowerCase()];
  if (idx == null) return null;

  const fingerName = FINGER_NAMES[idx];
  const hand: Hand = idx < 4 ? "left" : "right";
  const fingerIndex = hand === "left" ? idx : idx - 3;
  const tip =
    TIPS[key.toLowerCase()] ??
    `Keep your other fingers on home row and let your ${fingerName} do the reaching.`;

  return {
    key,
    fingerName,
    hand,
    fingerIndex,
    tip,
  };
}
