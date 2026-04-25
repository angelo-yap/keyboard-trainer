import { TOP_500 } from "../../data/topWords";
import { classicWordsGenerator } from "./classicWordsGenerator";
import { buildWordString, randomItem, wordsForDuration } from "./generatorUtils";
import type {
  AdaptiveWeakLetterGeneratorOptions,
  TestGenerator,
} from "./types";

const SIMPLE_ONSETS = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "w"];
const SIMPLE_CODAS = ["n", "t", "l", "r", "s", "m", "d"];
const VOWELS = ["a", "e", "i", "o", "u"];

function buildFallbackPracticeWord(letter: string): string {
  if (VOWELS.includes(letter)) {
    const onset = randomItem(SIMPLE_ONSETS);
    const coda = randomItem(SIMPLE_CODAS);
    const patterns = [
      `${onset}${letter}`,
      `${onset}${letter}${coda}`,
      `${onset}r${letter}`,
      `${letter}${coda}`,
    ];
    return randomItem(patterns);
  }

  const vowel = randomItem(VOWELS);
  const onset = randomItem(SIMPLE_ONSETS.filter((item) => item !== letter));
  const coda = randomItem(SIMPLE_CODAS.filter((item) => item !== letter));
  const patterns = [
    `${letter}${vowel}`,
    `${letter}${vowel}${coda}`,
    `${onset}${vowel}${letter}`,
    `${onset}${letter}${vowel}`,
    `${letter}e`,
  ];
  return randomItem(patterns);
}

function chooseWeightedWeakLetter(targets: NonNullable<AdaptiveWeakLetterGeneratorOptions["adaptiveTargets"]>): string {
  const weightedPool = targets.flatMap((target) => {
    const score = target.score ?? target.accuracy;
    const weight = Math.max(1, Math.round((100 - score) / 4) + Math.min(target.errors, 4));
    return Array.from({ length: weight }, () => target.key);
  });
  return randomItem(weightedPool);
}

function generateAdaptiveWords(options: AdaptiveWeakLetterGeneratorOptions, wordCount: number): string[] | null {
  const weakLetters = options.adaptiveTargets ?? [];
  if (weakLetters.length < 2) {
    return null;
  }

  const targetLetters = new Set(weakLetters.map((entry) => entry.key));
  const letterWordMap = new Map<string, string[]>();

  for (const entry of weakLetters) {
    const words = TOP_500.filter((word) => word.includes(entry.key) && word.length <= 7);
    letterWordMap.set(entry.key, words);
  }

  const candidateWords = TOP_500.filter((word) => {
    if (word.length > 7) return false;
    for (const char of word) {
      if (targetLetters.has(char)) {
        return true;
      }
    }
    return false;
  });

  if (candidateWords.length < 12) {
    return null;
  }

  const words: string[] = [];

  while (words.length < wordCount) {
    const targetLetter = chooseWeightedWeakLetter(weakLetters);
    const targetWords = letterWordMap.get(targetLetter) ?? [];

    if (targetWords.length > 0 && Math.random() < 0.8) {
      words.push(randomItem(targetWords));
      continue;
    }

    if (candidateWords.length > 0 && Math.random() < 0.5) {
      words.push(randomItem(candidateWords));
      continue;
    }

    words.push(buildFallbackPracticeWord(targetLetter));
  }

  return words;
}

export const adaptiveWeakLetterGenerator: TestGenerator<AdaptiveWeakLetterGeneratorOptions> = {
  validateOptions(options) {
    if (typeof options.includePunctuation !== "boolean") {
      return { valid: false, reason: "Adaptive generator requires includePunctuation to be a boolean." };
    }

    if (typeof options.includeNumbers !== "boolean") {
      return { valid: false, reason: "Adaptive generator requires includeNumbers to be a boolean." };
    }

    if (options.adaptiveTargets != null && !Array.isArray(options.adaptiveTargets)) {
      return { valid: false, reason: "Adaptive generator requires adaptiveTargets to be an array when provided." };
    }

    const adaptiveTargets = (options.adaptiveTargets ?? []).filter((entry) => {
      return (
        typeof entry?.key === "string" &&
        /^[a-z]$/.test(entry.key) &&
        typeof entry.accuracy === "number" &&
        typeof entry.attempts === "number" &&
        typeof entry.errors === "number"
      );
    });

    if ((options.adaptiveTargets ?? []).length !== adaptiveTargets.length) {
      return { valid: false, reason: "Adaptive generator received malformed adaptiveTargets entries." };
    }

    return {
      valid: true,
      options: {
        includePunctuation: options.includePunctuation,
        includeNumbers: options.includeNumbers,
        adaptiveTargets,
      },
    };
  },

  generateInitialText({ durationSeconds, options }) {
    const wordCount = Math.max(wordsForDuration(durationSeconds) * 2, 80);
    const adaptiveWords = generateAdaptiveWords(options, wordCount);

    if (!adaptiveWords) {
      return classicWordsGenerator.generateInitialText({
        durationSeconds,
        options,
      });
    }

    return buildWordString(adaptiveWords, options.includePunctuation, options.includeNumbers);
  },

  generateChunk({ wordCount, options }) {
    const adaptiveWords = generateAdaptiveWords(options, wordCount);

    if (!adaptiveWords) {
      return classicWordsGenerator.generateChunk({
        wordCount,
        options,
      });
    }

    return buildWordString(adaptiveWords, options.includePunctuation, options.includeNumbers);
  },
};
