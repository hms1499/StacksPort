import { describe, it, expect } from "vitest";
import {
  normalizeAILocale,
  languageDirective,
  chatLanguageDirective,
} from "./ai-language";

describe("normalizeAILocale", () => {
  it("passes through supported non-en locales", () => {
    expect(normalizeAILocale("vi")).toBe("vi");
    expect(normalizeAILocale("zh")).toBe("zh");
  });

  it("falls back to en for en, unknown, and empty input", () => {
    expect(normalizeAILocale("en")).toBe("en");
    expect(normalizeAILocale("fr")).toBe("en");
    expect(normalizeAILocale(null)).toBe("en");
    expect(normalizeAILocale(undefined)).toBe("en");
    expect(normalizeAILocale("")).toBe("en");
  });
});

describe("languageDirective", () => {
  it("is empty for English (prompt unchanged)", () => {
    expect(languageDirective("en")).toBe("");
    expect(languageDirective("fr")).toBe("");
  });

  it("names the target language for supported locales", () => {
    expect(languageDirective("zh")).toContain("Simplified Chinese");
    expect(languageDirective("vi")).toContain("Vietnamese");
  });

  it("instructs the model to preserve enum values and tickers", () => {
    const d = languageDirective("zh");
    expect(d).toContain("bullish");
    expect(d).toContain("STX");
    expect(d.toLowerCase()).toContain("do not translate");
  });
});

describe("chatLanguageDirective", () => {
  it("is empty for English", () => {
    expect(chatLanguageDirective("en")).toBe("");
  });

  it("names the language and survives any user input language", () => {
    expect(chatLanguageDirective("zh")).toContain("Simplified Chinese");
    expect(chatLanguageDirective("zh")).toContain("regardless of the language");
  });
});
