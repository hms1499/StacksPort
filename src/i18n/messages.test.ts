import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Json, path)
      : [path];
  });
}

describe("message catalogs", () => {
  it("vi has every key that en has", () => {
    const enKeys = new Set(flatten(en as Json));
    const viKeys = new Set(flatten(vi as Json));
    const missing = [...enKeys].filter((k) => !viKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("vi has no extra keys beyond en", () => {
    const enKeys = new Set(flatten(en as Json));
    const viKeys = new Set(flatten(vi as Json));
    const extra = [...viKeys].filter((k) => !enKeys.has(k));
    expect(extra).toEqual([]);
  });
});
