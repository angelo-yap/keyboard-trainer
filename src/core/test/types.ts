import type { WeakKeyStat } from "../storage/keyStatsStore";

import type { NormalizedCodeSnippet } from "./providers/codeSnippetProvider";
import type { NormalizedQuote } from "./providers/quoteProvider";

export type TestMode = "standard" | "adaptive" | "quotes" | "code";

export type ClassicWordsGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  randomCase: boolean;
};

export type AdaptiveWeakLetterGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  randomCase: boolean;
  adaptiveTargets?: WeakKeyStat[];
};

export type QuotesGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  randomCase: boolean;
  quote?: NormalizedQuote;
};

export type CodeSnippetGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  randomCase: boolean;
  snippet?: NormalizedCodeSnippet;
};

export type TestModeOptionsMap = {
  standard: ClassicWordsGeneratorOptions;
  adaptive: AdaptiveWeakLetterGeneratorOptions;
  quotes: QuotesGeneratorOptions;
  code: CodeSnippetGeneratorOptions;
};

export type TestModeConfig = {
  [K in TestMode]: {
    mode: K;
    options: TestModeOptionsMap[K];
  };
}[TestMode];

export type TestGeneratorValidation<TOptions> =
  | { valid: true; options: TOptions }
  | { valid: false; reason: string };

export type TestGenerator<TOptions> = {
  generateInitialText(input: {
    durationSeconds: number;
    options: TOptions;
  }): string;
  generateChunk(input: {
    wordCount: number;
    options: TOptions;
  }): string;
  validateOptions(options: TOptions): TestGeneratorValidation<TOptions>;
};
