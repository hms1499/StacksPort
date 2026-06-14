// src/lib/server/ai-language.ts
// One place that maps the UI locale to a prompt directive, so every AI route
// (insights, portfolio alerts, chat) localizes the model's free text the same
// way. Pure + tiny → unit-testable without a model.
//
// Machine-read tokens (JSON keys, enum values, tickers, numbers, URLs) MUST stay
// verbatim: the zod schemas validate those enums, so a translated "bullish"
// would fail parsing and drop the whole response. The directives say so loudly.

/** Locales whose AI output we localize. `en` (and anything unknown) → English. */
const LANGUAGE_NAMES: Record<string, string> = {
  vi: "Vietnamese",
  zh: "Simplified Chinese (简体中文)",
};

/** Every locale the AI cache may be keyed under (en + the localized ones). Used
 *  to fan-out cache invalidation across languages for one address. */
export const AI_LOCALES: readonly string[] = ["en", ...Object.keys(LANGUAGE_NAMES)];

/** Normalize an arbitrary locale string to a supported one (default `"en"`). */
export function normalizeAILocale(raw: string | null | undefined): string {
  return raw && raw in LANGUAGE_NAMES ? raw : "en";
}

/**
 * Suffix for JSON-producing prompts: write free-text fields in the locale's
 * language but leave keys/enums/tickers/numbers/URLs untouched. Empty string for
 * English so the default-English prompts stay byte-identical.
 */
export function languageDirective(locale: string): string {
  const name = LANGUAGE_NAMES[locale];
  if (!name) return "";
  return `\n\nLANGUAGE — IMPORTANT: Write every human-readable text value (summaries, insights, titles, descriptions, sentences) in ${name}. Do NOT translate or alter: JSON keys; enum values such as "bullish", "bearish", "neutral", "opportunity", "warning", "info", "high", "medium", "low", and any signalKind/action ids; ticker symbols (STX, sBTC, BTC, USDCx, aeUSDC); numbers; and URLs. Keep all of those exactly as specified.`;
}

/**
 * Suffix for the free-form chat system prompt (no JSON, no enums). Empty string
 * for English.
 */
export function chatLanguageDirective(locale: string): string {
  const name = LANGUAGE_NAMES[locale];
  if (!name) return "";
  return `\n\nAlways write your reply in ${name}, regardless of the language the user writes in. Keep ticker symbols (STX, sBTC, BTC, USDCx) and numbers as-is.`;
}
