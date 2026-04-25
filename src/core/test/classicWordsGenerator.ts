import type { ClassicWordsGeneratorOptions, TestGenerator } from "./types";
import { buildClassicWordList, buildWordString, wordsForDuration } from "./generatorUtils";

export const classicWordsGenerator: TestGenerator<ClassicWordsGeneratorOptions> = {
  validateOptions(options) {
    if (typeof options.includePunctuation !== "boolean") {
      return { valid: false, reason: "Classic generator requires includePunctuation to be a boolean." };
    }

    if (typeof options.includeNumbers !== "boolean") {
      return { valid: false, reason: "Classic generator requires includeNumbers to be a boolean." };
    }

    if (!["lowercase", "uppercase", "mixed"].includes(options.caseMode)) {
      return { valid: false, reason: "Classic generator requires caseMode to be lowercase, uppercase, or mixed." };
    }

    return {
      valid: true,
      options: {
        includePunctuation: options.includePunctuation,
        includeNumbers: options.includeNumbers,
        caseMode: options.caseMode,
      },
    };
  },

  generateInitialText({ durationSeconds, options }) {
    const wordCount = Math.max(wordsForDuration(durationSeconds) * 2, 80);
    const words = buildClassicWordList(wordCount);
    return buildWordString(words, options.includePunctuation, options.includeNumbers, options.caseMode);
  },

  generateChunk({ wordCount, options }) {
    const words = buildClassicWordList(wordCount);
    return buildWordString(words, options.includePunctuation, options.includeNumbers, options.caseMode);
  },
};
