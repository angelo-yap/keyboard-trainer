import { describe, expect, it, vi, afterEach } from "vitest";
import { classicWordsGenerator } from "./classicWordsGenerator";
import { adaptiveWeakLetterGenerator } from "./adaptiveWeakLetterGenerator";
import { codeSnippetGenerator } from "./codeSnippetGenerator";
import { quotesGenerator } from "./quotesGenerator";
import { TEST_GENERATORS } from "./registry";
import { applyRandomCase } from "./generatorUtils";
import { getRandomLocalCodeSnippet } from "./providers/codeSnippetProvider";
import { fetchQuote } from "./providers/quoteProvider";

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
    expect(TEST_GENERATORS.quotes).toBe(quotesGenerator);
    expect(TEST_GENERATORS.code).toBe(codeSnippetGenerator);
  });

  it("quotes generator keeps natural sentence punctuation from quote text", () => {
    const text = quotesGenerator.generateInitialText({
      durationSeconds: 15,
      options: {
        includePunctuation: true,
        includeNumbers: true,
        randomCase: false,
        quote: {
          id: "test-quote",
          text: "Practice should feel like real writing, not only word lists.",
          author: "Test Author",
          source: "Test",
        },
      },
    });

    expect(text).toContain("Practice should feel like real writing, not only word lists. Test Author");
    expect(text).toBe("Practice should feel like real writing, not only word lists. Test Author");
  });

  it("quotes generator preserves quote capitalization even if random case is enabled", () => {
    const text = quotesGenerator.generateInitialText({
      durationSeconds: 15,
      options: {
        includePunctuation: true,
        includeNumbers: true,
        randomCase: true,
        quote: {
          id: "case-test",
          text: "This sentence should not become Title Case.",
          author: "Case Author",
          source: "Test",
        },
      },
    });

    expect(text).toContain("This sentence should not become Title Case. Case Author");
    expect(text).not.toContain("This Sentence Should Not Become Title Case");
  });

  it("quote provider pulls from bundled local passages by default", async () => {
    const result = await fetchQuote({
      retries: 0,
      timeoutMs: 1,
      fetchImpl: vi.fn().mockRejectedValue(new Error("offline")),
    });

    expect(result.sourceType).toBe("local");
    expect(result.failureReason).toBeUndefined();
    expect(result.quote.text.length).toBeGreaterThan(0);
  });

  it("quote provider can still normalize successful ZenQuotes responses when local-first is disabled", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          h: "zen-42",
          q: "  Keep\tmoving\nforward. <script> ",
          a: "  Someone  ",
        },
      ],
    });

    const result = await fetchQuote({
      preferLocal: false,
      retries: 0,
      timeoutMs: 100,
      fetchImpl,
    });

    expect(result.sourceType).toBe("api");
    expect(result.quote).toEqual({
      id: "zen-42",
      text: "Keep moving forward. script",
      author: "Someone",
      source: "ZenQuotes",
    });
  });

  it("code generator uses exactly one snippet and preserves code casing", () => {
    const text = codeSnippetGenerator.generateInitialText({
      durationSeconds: 15,
      options: {
        includePunctuation: true,
        includeNumbers: true,
        randomCase: true,
        snippet: {
          id: "code-test",
          language: "TypeScript",
          source: "Example",
          text: "const userName = formatName(input.value);",
        },
      },
    });

    expect(text).toBe("const userName = formatName(input.value);");
  });

  it("code provider pulls a bundled local snippet", () => {
    const snippet = getRandomLocalCodeSnippet();

    expect(snippet.text.length).toBeGreaterThan(0);
    expect(snippet.language.length).toBeGreaterThan(0);
    expect(snippet.source.length).toBeGreaterThan(0);
  });
});
