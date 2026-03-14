/**
 * Generates typing test text with optional punctuation and numbers.
 * Used by the Test page.
 */

import { shuffle } from "../../lib/shuffle";
import { TOP_500 } from "../../data/topWords";

const PUNCTUATION = [".", ",", "!", "?", ";", ":", "'"];
const NUMBERS = "0123456789";

/** Estimate words needed for duration at ~50 WPM average */
function wordsForDuration(seconds: number): number {
  const minutes = seconds / 60;
  return Math.ceil(minutes * 55);
}

export type TestTextOptions = {
  durationSeconds: number;
  includePunctuation: boolean;
  includeNumbers: boolean;
};

export function generateTestText(options: TestTextOptions): string {
  const { durationSeconds, includePunctuation, includeNumbers } = options;
  const wordCount = wordsForDuration(durationSeconds);
  const words = shuffle([...TOP_500]).slice(0, wordCount);

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
