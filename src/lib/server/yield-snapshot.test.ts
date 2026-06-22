import { describe, expect, it } from "vitest";
import { buildYieldSnapshot } from "./yield-snapshot";

describe("buildYieldSnapshot", () => {
  it("marks both sources ok when present", () => {
    const s = buildYieldSnapshot({
      stackingApy: 3.92,
      zest: { USDC: 0.32 },
      generatedAt: 123,
    });
    expect(s).toEqual({
      generatedAt: 123,
      stackingApy: 3.92,
      zest: { USDC: 0.32 },
      sources: { stackingDao: "ok", zest: "ok" },
    });
  });

  it("marks a missing source unavailable and defaults zest to {}", () => {
    const s = buildYieldSnapshot({ stackingApy: null, zest: null, generatedAt: 1 });
    expect(s.stackingApy).toBeNull();
    expect(s.zest).toEqual({});
    expect(s.sources).toEqual({ stackingDao: "unavailable", zest: "unavailable" });
  });

  it("treats an empty zest map as unavailable", () => {
    const s = buildYieldSnapshot({ stackingApy: 5, zest: {}, generatedAt: 1 });
    expect(s.sources.zest).toBe("unavailable");
  });
});
