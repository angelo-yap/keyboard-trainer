import { getGuidanceForKey } from "./lessonGuidance";

export type FingerCallout = {
  key: string;
  fingerName: string;
  hand: "left" | "right" | "both";
  fingerIndex: number;
  tip: string;
  primaryInstruction?: string;
};

/** Get callout for instruction bar. Returns valid guidance for space (thumb). */
export function getCallout(key: string): FingerCallout | null {
  const g = getGuidanceForKey(key);
  if (!g) return null;
  return {
    key: g.key,
    fingerName: g.fingerName,
    hand: g.hand,
    fingerIndex: g.fingerIndex,
    tip: g.tip,
    primaryInstruction: g.primaryInstruction,
  };
}
