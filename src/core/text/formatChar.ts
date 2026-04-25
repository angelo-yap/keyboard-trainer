export function formatKeyLabel(value: unknown): string {
  const normalized = String(value ?? "");

  if (normalized.trim() === "") {
    return "Space";
  }

  if (
    normalized === "Space" ||
    normalized === "space" ||
    normalized === "Spacebar" ||
    normalized === "SpaceBar"
  ) {
    return "Space";
  }

  return normalized;
}

export const formatChar = formatKeyLabel;
