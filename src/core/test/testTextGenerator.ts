/**
 * Generates typing test text with optional punctuation and numbers.
 * Used by the Test page.
 */

import { shuffle } from "../../lib/shuffle";
import { TOP_500 } from "../../data/topWords";
import type { WeakKeyStat } from "../storage/keyStatsStore";

const PUNCTUATION = [".", ",", "!", "?", ";", ":", "'"];
const NUMBERS = "0123456789";
const SIMPLE_ONSETS = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "w"];
const SIMPLE_CODAS = ["n", "t", "l", "r", "s", "m", "d"];
const VOWELS = ["a", "e", "i", "o", "u"];

/** Estimate words needed for duration at ~50 WPM average */
function wordsForDuration(seconds: number): number {
  const minutes = seconds / 60;
  return Math.ceil(minutes * 55);
}

export type TestTextOptions = {
  durationSeconds: number;
  includePunctuation: boolean;
  includeNumbers: boolean;
  mode?: "standard" | "adaptive";
  adaptiveTargets?: WeakKeyStat[];
};

type TestMode = NonNullable<TestTextOptions["mode"]>;
type WeakLetterTarget = WeakKeyStat;

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildWordString(
  words: string[],
  includePunctuation: boolean,
  includeNumbers: boolean
): string {
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    let word = words[i];

    if (includeNumbers && Math.random() < 0.08) {
      const numLen = 1 + Math.floor(Math.random() * 3);
      let num = "";
      for (let j = 0; j < numLen; j++) {
        num += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
      }
      word = num;
    }

    result.push(word);

    if (i < words.length - 1) {
      if (includePunctuation && Math.random() < 0.15) {
        result.push(PUNCTUATION[Math.floor(Math.random() * PUNCTUATION.length)]);
      }
      result.push(" ");
    }
  }

  return result.join("");
}

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

function chooseWeightedWeakLetter(targets: WeakLetterTarget[]): string {
  const weightedPool = targets.flatMap((target) => {
    const weight = Math.max(1, Math.round((100 - target.accuracy) / 4) + Math.min(target.errors, 4));
    return Array.from({ length: weight }, () => target.key);
  });
  return randomItem(weightedPool);
}

function generateAdaptiveWords(
  wordCount: number,
  adaptiveTargets: WeakLetterTarget[] | undefined
): string[] | null {
  const weakLetters = adaptiveTargets ?? [];
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

  const shuffledCandidates = shuffle([...candidateWords]);
  const words: string[] = [];

  while (words.length < wordCount) {
    const targetLetter = chooseWeightedWeakLetter(weakLetters);
    const targetWords = letterWordMap.get(targetLetter) ?? [];

    if (targetWords.length > 0 && Math.random() < 0.8) {
      words.push(randomItem(targetWords));
      continue;
    }

    if (shuffledCandidates.length > 0 && Math.random() < 0.5) {
      words.push(shuffledCandidates[words.length % shuffledCandidates.length]);
      continue;
    }

    words.push(buildFallbackPracticeWord(targetLetter));
  }

  return words;
}

/**
 * Build a chunk of words as a string (no trailing space).
 * Each chunk is independently shuffled so repetition is minimised.
 */
export function generateWordChunk(
  wordCount: number,
  includePunctuation: boolean,
  includeNumbers: boolean,
  mode: TestMode = "standard",
  adaptiveTargets?: WeakLetterTarget[]
): string {
  if (mode === "adaptive") {
    const adaptiveWords = generateAdaptiveWords(wordCount, adaptiveTargets);
    if (adaptiveWords) {
      return buildWordString(adaptiveWords, includePunctuation, includeNumbers);
    }
  }

  // Cycle through the word pool with shuffled passes to avoid repetition
  const pool = shuffle([...TOP_500]);
  const words: string[] = [];
  while (words.length < wordCount) {
    words.push(...pool.slice(0, wordCount - words.length));
    if (words.length < wordCount) pool.push(...shuffle([...TOP_500]));
  }

  return buildWordString(words, includePunctuation, includeNumbers);
}

export function generateTestText(options: TestTextOptions): string {
  const {
    durationSeconds,
    includePunctuation,
    includeNumbers,
    mode = "standard",
    adaptiveTargets,
  } = options;
  // Generate a large initial buffer - enough for even the fastest typist
  // at 200 WPM for the full duration, with a comfortable extra margin.
  const wordCount = Math.max(wordsForDuration(durationSeconds) * 2, 80);
  return generateWordChunk(wordCount, includePunctuation, includeNumbers, mode, adaptiveTargets);
}
