import { getRandomLocalCodeSnippet, type NormalizedCodeSnippet } from "./providers/codeSnippetProvider";
import type { CodeSnippetGeneratorOptions, TestGenerator } from "./types";

function buildCodeText(snippet: NormalizedCodeSnippet): string {
  return snippet.text;
}

export const codeSnippetGenerator: TestGenerator<CodeSnippetGeneratorOptions> = {
  validateOptions(options) {
    if (typeof options.includePunctuation !== "boolean") {
      return { valid: false, reason: "Code generator requires includePunctuation to be a boolean." };
    }

    if (typeof options.includeNumbers !== "boolean") {
      return { valid: false, reason: "Code generator requires includeNumbers to be a boolean." };
    }

    if (typeof options.randomCase !== "boolean") {
      return { valid: false, reason: "Code generator requires randomCase to be a boolean." };
    }

    if (options.snippet != null && typeof options.snippet.text !== "string") {
      return { valid: false, reason: "Code generator requires snippet text when a snippet is provided." };
    }

    return {
      valid: true,
      options: {
        includePunctuation: true,
        includeNumbers: true,
        randomCase: false,
        snippet: options.snippet,
      },
    };
  },

  generateInitialText({ durationSeconds, options }) {
    void durationSeconds;
    return buildCodeText(options.snippet ?? getRandomLocalCodeSnippet());
  },

  generateChunk({ wordCount, options }) {
    void wordCount;
    return buildCodeText(options.snippet ?? getRandomLocalCodeSnippet());
  },
};
