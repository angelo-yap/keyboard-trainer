import { shuffle } from "../../lib/shuffle";
import { TOP_500 } from "../../data/topWords";

export const PUNCTUATION = [".", ",", "!", "?", ";", ":", "'"];
export const NUMBERS = "0123456789";

export function wordsForDuration(seconds: number): number {
  const minutes = seconds / 60;
  return Math.ceil(minutes * 55);
}

export function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildClassicWordList(wordCount: number): string[] {
  const pool = shuffle([...TOP_500]);
  const words: string[] = [];

  while (words.length < wordCount) {
    words.push(...pool.slice(0, wordCount - words.length));
    if (words.length < wordCount) {
      pool.push(...shuffle([...TOP_500]));
    }
  }

  return words;
}

export function buildWordString(
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
