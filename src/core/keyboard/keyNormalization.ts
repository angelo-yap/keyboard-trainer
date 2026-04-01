export const SHIFTED_SYMBOL_BASE_KEY: Record<string, string> = {
  "~": "`",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  _: "-",
  "+": "=",
  "{": "[",
  "}": "]",
  "|": "\\",
  ":": ";",
  '"': "'",
  "<": ",",
  ">": ".",
  "?": "/",
};

export function normalizeTargetKeyForGuidance(char: string): string {
  if (!char) return "";
  if (char === " ") return " ";

  if (SHIFTED_SYMBOL_BASE_KEY[char]) {
    return SHIFTED_SYMBOL_BASE_KEY[char];
  }

  if (/^[A-Za-z]$/.test(char)) {
    return char.toLowerCase();
  }

  if (/^[0-9`\-=\[\]\\;',./]$/.test(char)) {
    return char;
  }

  return "";
}

export function getGuidanceKeysForChar(char: string): string[] {
  if (!char) return [];

  const base = normalizeTargetKeyForGuidance(char);
  if (!base) return [];

  if (/^[A-Z]$/.test(char)) {
    return ["shift", base];
  }

  if (char in SHIFTED_SYMBOL_BASE_KEY) {
    return ["shift", base];
  }

  return [base];
}
