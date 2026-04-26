import { getLS, setLS } from "../../storage/localStorage";
import localPassages from "./localPassages.txt?raw";

export type QuoteSourceType = "api" | "cache" | "local";

export type NormalizedQuote = {
  text: string;
  author: string;
  source: string;
  id: string;
};

export type QuoteFetchResult = {
  quote: NormalizedQuote;
  sourceType: QuoteSourceType;
  failureReason?: string;
};

type QuoteProviderName = "ZenQuotes";

export type QuoteProviderOptions = {
  timeoutMs: number;
  retries: number;
  minLength: number;
  maxLength: number;
  fetchImpl: typeof fetch;
  preferLocal: boolean;
  endpoints: Partial<Record<QuoteProviderName, string>>;
};

type QuoteProvider = {
  source: QuoteProviderName;
  endpoint: string;
  normalize(payload: unknown, maxLength: number): NormalizedQuote | null;
};

const QUOTE_CACHE_KEY = "kt_quote_cache";
const DEFAULT_OPTIONS: QuoteProviderOptions = {
  timeoutMs: 1600,
  retries: 1,
  minLength: 24,
  maxLength: 900,
  fetchImpl: (...args) => fetch(...args),
  preferLocal: true,
  endpoints: {},
};

const PROVIDERS: QuoteProvider[] = [
  {
    source: "ZenQuotes",
    endpoint: "https://zenquotes.io/api/random",
    normalize(payload, maxLength) {
      const [item] = Array.isArray(payload) ? payload : [];
      const quote = item as { q?: unknown; a?: unknown; h?: unknown } | undefined;
      return normalizeQuote({
        text: quote?.q,
        author: quote?.a,
        source: "ZenQuotes",
        id: quote?.h,
        maxLength,
      });
    },
  },
];

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return sanitizeText(value);
}

function normalizeQuote(input: {
  text: unknown;
  author: unknown;
  source: string;
  id: unknown;
  maxLength: number;
}): NormalizedQuote | null {
  const text = sanitizeText(input.text);
  if (!text || text.length > input.maxLength) return null;

  const author = sanitizeText(input.author) || "Unknown";
  const id = sanitizeId(input.id) || `${input.source}:${text.slice(0, 32)}`;

  return {
    text,
    author,
    source: input.source,
    id,
  };
}

function isQuote(value: unknown): value is NormalizedQuote {
  const quote = value as Partial<NormalizedQuote>;
  return (
    typeof quote?.text === "string" &&
    quote.text.length > 0 &&
    typeof quote.author === "string" &&
    typeof quote.source === "string" &&
    typeof quote.id === "string"
  );
}

function getCachedQuote(maxLength: number): NormalizedQuote | null {
  const quote = getLS<NormalizedQuote | null>(QUOTE_CACHE_KEY, null);
  if (!isQuote(quote)) return null;

  return normalizeQuote({
    text: quote.text,
    author: quote.author,
    source: quote.source,
    id: quote.id,
    maxLength,
  });
}

function cacheQuote(quote: NormalizedQuote): void {
  setLS(QUOTE_CACHE_KEY, quote);
}

export function getLocalQuotes(maxLength = DEFAULT_OPTIONS.maxLength): NormalizedQuote[] {
  return parseLocalPassages(localPassages)
    .map((quote) =>
      normalizeQuote({
        ...quote,
        source: quote.source ?? "Local Passages",
        maxLength,
      })
    )
    .filter(isQuote);
}

function parseLocalPassages(raw: string): Array<{ id: string; text: string; author: string; source: string }> {
  return raw
    .split(/\n(?=:: )/g)
    .map((block) => {
      const [header = "", ...bodyLines] = block.trim().split("\n");
      const match = header.match(/^::\s*([^|]+)\|\s*([^|]+)\|\s*(.+)$/);
      if (!match) return null;

      return {
        id: match[1].trim(),
        author: match[2].trim(),
        source: match[3].trim(),
        text: bodyLines.join(" ").trim(),
      };
    })
    .filter((quote): quote is { id: string; text: string; author: string; source: string } => quote !== null);
}

export function getRandomLocalQuote(maxLength = DEFAULT_OPTIONS.maxLength): NormalizedQuote {
  const quotes = getLocalQuotes(maxLength);
  return quotes[Math.floor(Math.random() * quotes.length)];
}

async function fetchJsonWithTimeout(
  endpoint: string,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromProvider(
  provider: QuoteProvider,
  endpoint: string,
  options: QuoteProviderOptions
): Promise<NormalizedQuote> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      const payload = await fetchJsonWithTimeout(endpoint, options.timeoutMs, options.fetchImpl);
      const quote = provider.normalize(payload, options.maxLength);
      if (!quote || quote.text.length < options.minLength) {
        throw new Error(`${provider.source} returned no usable quote.`);
      }
      return quote;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${provider.source} request failed.`);
}

function failureMessage(provider: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "request failed";
  return `${provider}: ${message}`;
}

export async function fetchQuote(
  partialOptions: Partial<QuoteProviderOptions> = {}
): Promise<QuoteFetchResult> {
  const options = { ...DEFAULT_OPTIONS, ...partialOptions };
  const failures: string[] = [];
  const localQuote = getRandomLocalQuote(options.maxLength);

  if (options.preferLocal) {
    return {
      quote: localQuote,
      sourceType: "local",
    };
  }

  for (const provider of PROVIDERS) {
    try {
      const endpoint = options.endpoints[provider.source] ?? provider.endpoint;
      const quote = await fetchFromProvider(provider, endpoint, options);
      cacheQuote(quote);
      return { quote, sourceType: "api" };
    } catch (error) {
      failures.push(failureMessage(provider.source, error));
    }
  }

  const failureReason = failures.join(" | ");
  const cachedQuote = getCachedQuote(options.maxLength);
  if (cachedQuote && cachedQuote.text.length >= options.minLength) {
    return {
      quote: cachedQuote,
      sourceType: "cache",
      failureReason,
    };
  }

  return {
    quote: localQuote,
    sourceType: "local",
    failureReason,
  };
}
