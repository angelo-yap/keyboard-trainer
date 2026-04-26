import { getRandomLocalQuote, type NormalizedQuote } from "./providers/quoteProvider";
import type { QuotesGeneratorOptions, TestGenerator } from "./types";

function formatQuote(quote: NormalizedQuote): string {
  return `${quote.text} ${quote.author}`;
}

function buildQuoteText(seedQuote: NormalizedQuote): string {
  return formatQuote(seedQuote);
}

export const quotesGenerator: TestGenerator<QuotesGeneratorOptions> = {
  validateOptions(options) {
    if (typeof options.includePunctuation !== "boolean") {
      return { valid: false, reason: "Quotes generator requires includePunctuation to be a boolean." };
    }

    if (typeof options.includeNumbers !== "boolean") {
      return { valid: false, reason: "Quotes generator requires includeNumbers to be a boolean." };
    }

    if (typeof options.randomCase !== "boolean") {
      return { valid: false, reason: "Quotes generator requires randomCase to be a boolean." };
    }

    if (options.quote != null && typeof options.quote.text !== "string") {
      return { valid: false, reason: "Quotes generator requires quote text when a quote is provided." };
    }

    return {
      valid: true,
      options: {
        includePunctuation: options.includePunctuation,
        includeNumbers: options.includeNumbers,
        randomCase: false,
        quote: options.quote,
      },
    };
  },

  generateInitialText({ durationSeconds, options }) {
    void durationSeconds;
    return buildQuoteText(options.quote ?? getRandomLocalQuote());
  },

  generateChunk({ wordCount, options }) {
    void wordCount;
    return buildQuoteText(getRandomLocalQuote());
  },
};
