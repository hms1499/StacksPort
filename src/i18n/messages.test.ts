import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";
import zh from "../../messages/zh.json";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import es from "../../messages/es.json";
import pt from "../../messages/pt.json";

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Json, path)
      : [path];
  });
}

const enKeys = new Set(flatten(en as Json));

// Every non-default catalog must be key-for-key identical to en — no missing
// keys (untranslated holes) and no extras (stale keys). Add new locales here.
const catalogs: Record<string, Json> = { vi, zh, ja, ko, es, pt };

describe("message catalogs", () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    const localeKeys = new Set(flatten(messages));

    it(`${locale} has every key that en has`, () => {
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      expect(missing).toEqual([]);
    });

    it(`${locale} has no extra keys beyond en`, () => {
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));
      expect(extra).toEqual([]);
    });
  }
});
