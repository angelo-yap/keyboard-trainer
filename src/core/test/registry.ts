import { adaptiveWeakLetterGenerator } from "./adaptiveWeakLetterGenerator";
import { classicWordsGenerator } from "./classicWordsGenerator";
import type { TestGenerator, TestMode, TestModeOptionsMap } from "./types";

export const TEST_GENERATORS: {
  [K in TestMode]: TestGenerator<TestModeOptionsMap[K]>;
} = {
  standard: classicWordsGenerator,
  adaptive: adaptiveWeakLetterGenerator,
};

export function getTestGenerator<M extends TestMode>(
  mode: M
): TestGenerator<TestModeOptionsMap[M]> {
  return TEST_GENERATORS[mode];
}
