import { getWeakKeys } from "../storage/keyStatsStore";
import { formatKeyLabel } from "../text/formatChar";

export function getCoachMessage(): { message: string; detail: string } {
  const weakKeys = getWeakKeys().slice(0, 3);

  if (weakKeys.length === 0) {
    return {
      message: "Your accuracy is looking solid across the board.",
      detail: "Push for speed now — try a timed test when you feel ready.",
    };
  }

  const keyList = weakKeys
    .map((w) => `"${formatKeyLabel(w?.key)}"`)
    .join(", ");
  return {
    message: `You've been building a real habit. Keep an eye on ${keyList} — consistency there will unlock the next level.`,
    detail:
      "Try not to look down. Trust the callout and let the muscle memory form.",
  };
}
