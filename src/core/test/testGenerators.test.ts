import { describe, expect, it, vi, afterEach } from "vitest";
import { classicWordsGenerator } from "./classicWordsGenerator";
import { adaptiveWeakLetterGenerator } from "./adaptiveWeakLetterGenerator";
import { TEST_GENERATORS } from "./registry";

describe("test generators", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classic generator keeps punctuation and numbers options working", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const plain = classicWordsGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: false,
        includeNumbers: false,
      },
    });

    const withExtras = classicWordsGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: true,
        includeNumbers: true,
      },
    });

    expect(plain).not.toMatch(/[0-9]/);
    expect(plain).not.toContain(". ");
    expect(withExtras).toBe("0. 0. 0");
  });

  it("adaptive generator falls back when there is not enough key history", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const adaptive = adaptiveWeakLetterGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: false,
        includeNumbers: false,
        adaptiveTargets: [{ key: "q", accuracy: 40, attempts: 10, errors: 6 }],
      },
    });

    const classic = classicWordsGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: false,
        includeNumbers: false,
      },
    });

    expect(adaptive).toBe(classic);
  });

  it("validateOptions rejects invalid mode options", () => {
    expect(
      classicWordsGenerator.validateOptions({
        includePunctuation: "yes" as never,
        includeNumbers: false,
      })
    ).toEqual({
      valid: false,
      reason: "Classic generator requires includePunctuation to be a boolean.",
    });

    expect(
      adaptiveWeakLetterGenerator.validateOptions({
        includePunctuation: false,
        includeNumbers: false,
        adaptiveTargets: "bad" as never,
      })
    ).toEqual({
      valid: false,
      reason: "Adaptive generator requires adaptiveTargets to be an array when provided.",
    });
  });

  it("registry contains standard and adaptive modes", () => {
    expect(TEST_GENERATORS.standard).toBe(classicWordsGenerator);
    expect(TEST_GENERATORS.adaptive).toBe(adaptiveWeakLetterGenerator);
  });
});
