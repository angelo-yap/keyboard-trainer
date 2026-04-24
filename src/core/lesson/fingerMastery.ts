import { getAccuracy } from "../storage/keyStatsStore";

export type FingerState = "mastered" | "learning" | "weak" | "unlocked";

export type FingerMastery = {
  L5: FingerState;
  L4: FingerState;
  L3: FingerState;
  L2: FingerState;
  R2: FingerState;
  R3: FingerState;
  R4: FingerState;
  R5: FingerState;
};

const FINGER_KEYS: Record<keyof FingerMastery, string[]> = {
  L5: ["a", "z", "q"],
  L4: ["s", "x", "w"],
  L3: ["d", "c", "e"],
  L2: ["f", "v", "r", "g", "t", "b"],
  R2: ["j", "m", "u", "y", "h", "n"],
  R3: ["k", ",", "i"],
  R4: ["l", ".", "o"],
  R5: [";", "/", "p", "'"],
};

function fingerState(keys: string[]): FingerState {
  const stats = keys
    .map((k) => getAccuracy(k))
    .filter((v): v is number => v != null);
  if (stats.length === 0) return "unlocked";
  const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
  if (avg >= 92) return "mastered";
  if (avg >= 75) return "learning";
  return "weak";
}

export function getFingerMastery(): FingerMastery {
  return Object.fromEntries(
    Object.entries(FINGER_KEYS).map(([finger, keys]) => [
      finger,
      fingerState(keys),
    ])
  ) as FingerMastery;
}
