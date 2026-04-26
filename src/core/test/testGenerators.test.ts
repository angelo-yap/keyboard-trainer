import { describe, expect, it, vi, afterEach } from "vitest";
import { classicWordsGenerator } from "./classicWordsGenerator";
import { adaptiveWeakLetterGenerator } from "./adaptiveWeakLetterGenerator";
import { TEST_GENERATORS } from "./registry";
import { applyRandomCase } from "./generatorUtils";

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
        randomCase: false,
      },
    });

    const withExtras = classicWordsGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: true,
        includeNumbers: true,
        randomCase: false,
      },
    });

    expect(plain).not.toMatch(/[0-9]/);
    expect(plain).not.toContain(". ");
    expect(withExtras).toBe("0. 0. 0");
  });

  it("classic generator applies random case without clustered capitals", () => {
    const lowercase = classicWordsGenerator.generateChunk({
      wordCount: 2,
      options: {
        includePunctuation: false,
        includeNumbers: false,
        randomCase: false,
      },
    });

    vi.spyOn(Math, "random").mockImplementation(() => 0.4);
    const randomCase = applyRandomCase("make it like this at most", true);

    expect(lowercase).toBe(lowercase.toLowerCase());
    expect(randomCase).toMatch(/[A-Z]/);
    expect(randomCase).toMatch(/[a-z]/);
    expect(randomCase.split(/\s+/).every((word) => !/[A-Z]{2}/.test(word))).toBe(true);
  });

  it("adaptive generator falls back when there is not enough key history", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const adaptive = adaptiveWeakLetterGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: false,
        includeNumbers: false,
        randomCase: false,
        adaptiveTargets: [{ key: "q", accuracy: 40, attempts: 10, errors: 6, avgLatencyMs: null, score: 40 }],
      },
    });

    const classic = classicWordsGenerator.generateChunk({
      wordCount: 3,
      options: {
        includePunctuation: false,
        includeNumbers: false,
        randomCase: false,
      },
    });

    expect(adaptive).toBe(classic);
  });

  it("validateOptions rejects invalid mode options", () => {
    expect(
      classicWordsGenerator.validateOptions({
        includePunctuation: "yes" as never,
        includeNumbers: false,
        randomCase: false,
      })
    ).toEqual({
      valid: false,
      reason: "Classic generator requires includePunctuation to be a boolean.",
    });

    expect(
      adaptiveWeakLetterGenerator.validateOptions({
        includePunctuation: false,
        includeNumbers: false,
        randomCase: false,
        adaptiveTargets: "bad" as never,
      })
    ).toEqual({
      valid: false,
      reason: "Adaptive generator requires adaptiveTargets to be an array when provided.",
    });

    expect(
      classicWordsGenerator.validateOptions({
        includePunctuation: false,
        includeNumbers: false,
        randomCase: "yes" as never,
      })
    ).toEqual({
      valid: false,
      reason: "Classic generator requires randomCase to be a boolean.",
    });
  });

  it("registry contains standard and adaptive modes", () => {
    expect(TEST_GENERATORS.standard).toBe(classicWordsGenerator);
    expect(TEST_GENERATORS.adaptive).toBe(adaptiveWeakLetterGenerator);
  });
});
