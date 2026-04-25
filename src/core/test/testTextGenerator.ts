import { getTestGenerator } from "./registry";
import type {
  AdaptiveWeakLetterGeneratorOptions,
  ClassicWordsGeneratorOptions,
  TestGeneratorValidation,
  TestMode,
  TestModeConfig,
  TestModeOptionsMap,
} from "./types";

export type {
  AdaptiveWeakLetterGeneratorOptions,
  ClassicWordsGeneratorOptions,
  TestGenerator,
  TestMode,
  TestModeConfig,
  TestModeOptionsMap,
} from "./types";

export type TestTextOptions = TestModeConfig & {
  durationSeconds: number;
};

export type TestChunkOptions = TestModeConfig & {
  wordCount: number;
};

function validateModeOptions<M extends TestMode>(
  mode: M,
  options: TestModeOptionsMap[M]
): TestGeneratorValidation<TestModeOptionsMap[M]> {
  return getTestGenerator(mode).validateOptions(options);
}

export function validateTestModeConfig(
  config: TestModeConfig
): TestGeneratorValidation<TestModeConfig> {
  switch (config.mode) {
    case "standard": {
      const validation = validateModeOptions("standard", config.options);
      if (!validation.valid) {
        return validation;
      }
      return {
        valid: true,
        options: {
          mode: "standard",
          options: validation.options,
        },
      };
    }
    case "adaptive": {
      const validation = validateModeOptions("adaptive", config.options);
      if (!validation.valid) {
        return validation;
      }
      return {
        valid: true,
        options: {
          mode: "adaptive",
          options: validation.options,
        },
      };
    }
  }
}

export function generateWordChunk(input: TestChunkOptions): string {
  switch (input.mode) {
    case "standard": {
      const validation = validateModeOptions("standard", input.options);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      return getTestGenerator("standard").generateChunk({
        wordCount: input.wordCount,
        options: validation.options,
      });
    }
    case "adaptive": {
      const validation = validateModeOptions("adaptive", input.options);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      return getTestGenerator("adaptive").generateChunk({
        wordCount: input.wordCount,
        options: validation.options,
      });
    }
  }
}

export function generateTestText(input: TestTextOptions): string {
  switch (input.mode) {
    case "standard": {
      const validation = validateModeOptions("standard", input.options);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      return getTestGenerator("standard").generateInitialText({
        durationSeconds: input.durationSeconds,
        options: validation.options,
      });
    }
    case "adaptive": {
      const validation = validateModeOptions("adaptive", input.options);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      return getTestGenerator("adaptive").generateInitialText({
        durationSeconds: input.durationSeconds,
        options: validation.options,
      });
    }
  }
}
