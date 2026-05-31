import { describe, it, expect } from "vitest";
import { resolveInitialPair, fromTokens } from "./helpers";

describe("resolveInitialPair", () => {
  it("defaults to the first source token and no destination", () => {
    const { from, to } = resolveInitialPair(null, null);
    expect(from.id).toBe(fromTokens[0].id);
    expect(to).toBeNull();
  });

  it("honours an explicit from+to pair (case-insensitive)", () => {
    const { from, to } = resolveInitialPair("STX", "sBTC");
    expect(from.id).toBe("stx");
    expect(to?.id).toBe("sbtc");
  });

  it("infers a source when only `to` is given, preferring STX", () => {
    const { from, to } = resolveInitialPair(null, "sbtc");
    expect(to?.id).toBe("sbtc");
    expect(from.id).toBe("stx");
  });

  it("falls back to the first source for an unknown `from`", () => {
    const { from } = resolveInitialPair("not-a-token", null);
    expect(from.id).toBe(fromTokens[0].id);
  });

  it("ignores a `to` that is not a valid destination of `from`", () => {
    const { to } = resolveInitialPair("stx", "not-a-token");
    expect(to).toBeNull();
  });
});
