import { getTestGenerator } from "./registry";
import type {
  TestGeneratorValidation,
  TestMode,
  TestModeConfig,
  TestModeOptionsMap,
} from "./types";

export type {
  AdaptiveWeakLetterGeneratorOptions,
  ClassicWordsGeneratorOptions,
  CodeSnippetGeneratorOptions,
  QuotesGeneratorOptions,
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

type TestGeneratorConfig<M extends TestMode> = {
  mode: M;
  options: TestModeOptionsMap[M];
};

function withValidatedGenerator<M extends TestMode, TResult>(
  config: TestGeneratorConfig<M>,
  onValid: (input: {
    generator: ReturnType<typeof getTestGenerator<M>>;
    options: TestModeOptionsMap[M];
  }) => TResult,
  onInvalid: (reason: string) => TResult
): TResult {
  const generator = getTestGenerator(config.mode);
  const validation = generator.validateOptions(config.options);

  if (!validation.valid) {
    return onInvalid(validation.reason);
  }

  return onValid({
    generator,
    options: validation.options,
  });
}

export function validateTestModeConfig(
  config: TestModeConfig
): TestGeneratorValidation<TestModeConfig> {
  return withValidatedGenerator(
    config,
    ({ options }) => ({
      valid: true,
      options: {
        mode: config.mode,
        options,
      } as TestModeConfig,
    }),
    (reason) => ({ valid: false, reason })
  );
}

function throwValidationError(reason: string): never {
  throw new Error(reason);
}

export function generateWordChunk(input: TestChunkOptions): string {
  return withValidatedGenerator(
    input,
    ({ generator, options }) =>
      generator.generateChunk({
        wordCount: input.wordCount,
        options,
      }),
    throwValidationError
  );
}

export function generateTestText(input: TestTextOptions): string {
  return withValidatedGenerator(
    input,
    ({ generator, options }) =>
      generator.generateInitialText({
        durationSeconds: input.durationSeconds,
        options,
      }),
    throwValidationError
  );
}
