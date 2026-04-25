import type { WeakKeyStat } from "../storage/keyStatsStore";
import type { CaseMode } from "../storage/settingsStore";

export type TestMode = "standard" | "adaptive";

export type ClassicWordsGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  caseMode: CaseMode;
};

export type AdaptiveWeakLetterGeneratorOptions = {
  includePunctuation: boolean;
  includeNumbers: boolean;
  caseMode: CaseMode;
  adaptiveTargets?: WeakKeyStat[];
};

export type TestModeOptionsMap = {
  standard: ClassicWordsGeneratorOptions;
  adaptive: AdaptiveWeakLetterGeneratorOptions;
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
