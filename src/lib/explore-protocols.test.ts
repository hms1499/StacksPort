import { describe, it, expect } from "vitest";
import { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";

describe("EXPLORE_PROTOCOLS", () => {
  it("has 7 entries", () => {
    expect(EXPLORE_PROTOCOLS).toHaveLength(7);
  });

  it("every entry has required fields with valid values", () => {
    for (const p of EXPLORE_PROTOCOLS) {
      expect(p.name).toBeTruthy();
      expect(p.logoUrl).toMatch(/^https?:\/\//);
      expect(p.url).toMatch(/^https?:\/\//);
      expect(p.category).toBeTruthy();
      expect(p.tagline).toBeTruthy();
    }
  });

  it("includes all 7 expected protocols", () => {
    const names = EXPLORE_PROTOCOLS.map((p) => p.name);
    expect(names).toContain("StackingDAO");
    expect(names).toContain("Lisa");
    expect(names).toContain("Zest Protocol");
    expect(names).toContain("Arkadiko");
    expect(names).toContain("Bitflow");
    expect(names).toContain("ALEX");
    expect(names).toContain("Velar");
  });
});
