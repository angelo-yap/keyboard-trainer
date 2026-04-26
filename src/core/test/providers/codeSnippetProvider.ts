import localCodeSnippets from "./localCodeSnippets.txt?raw";

export type NormalizedCodeSnippet = {
  text: string;
  language: string;
  source: string;
  id: string;
};

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSnippet(value: unknown): value is NormalizedCodeSnippet {
  const snippet = value as Partial<NormalizedCodeSnippet>;
  return (
    typeof snippet?.text === "string" &&
    snippet.text.length > 0 &&
    typeof snippet.language === "string" &&
    typeof snippet.source === "string" &&
    typeof snippet.id === "string"
  );
}

function parseLocalCodeSnippets(raw: string): NormalizedCodeSnippet[] {
  return raw
    .split(/\n(?=:: )/g)
    .map((block) => {
      const [header = "", ...bodyLines] = block.trim().split("\n");
      const match = header.match(/^::\s*([^|]+)\|\s*([^|]+)\|\s*(.+)$/);
      if (!match) return null;

      return {
        id: sanitizeText(match[1]),
        language: sanitizeText(match[2]),
        source: sanitizeText(match[3]),
        text: sanitizeText(bodyLines.join(" ")),
      };
    })
    .filter(isSnippet);
}

export function getLocalCodeSnippets(): NormalizedCodeSnippet[] {
  return parseLocalCodeSnippets(localCodeSnippets);
}

export function getRandomLocalCodeSnippet(): NormalizedCodeSnippet {
  const snippets = getLocalCodeSnippets();
  return snippets[Math.floor(Math.random() * snippets.length)];
}
