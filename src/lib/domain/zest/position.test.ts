import { describe, expect, it } from "vitest";
import { buildSbtcPosition } from "./position";

describe("buildSbtcPosition", () => {
  it("maps sats to a position with sBTC amount", () => {
    expect(buildSbtcPosition(150_000)).toEqual({
      asset: "sBTC", suppliedSats: 150_000, suppliedSbtc: 0.0015,
    });
  });
  it("returns null for an empty position", () => {
    expect(buildSbtcPosition(0)).toBeNull();
    expect(buildSbtcPosition(-5)).toBeNull();
  });
});
