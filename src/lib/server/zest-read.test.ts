import { describe, expect, it, vi, afterEach } from "vitest";
import { getZestSbtcPosition } from "./zest-read";

afterEach(() => vi.restoreAllMocks());

function mockRead(result: string, okay = true) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    json: async () => ({ okay, result }),
  } as Response);
}

describe("getZestSbtcPosition", () => {
  it("returns a position for a non-zero a-token balance", async () => {
    // (ok u150000) serialized — verified hex value
    mockRead("0x0701000000000000000000000000000249f0"); // u150000
    const pos = await getZestSbtcPosition("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N");
    expect(pos).toEqual({ asset: "sBTC", suppliedSats: 150_000, suppliedSbtc: 0.0015 });
  });

  it("returns null when the read fails", async () => {
    mockRead("0x", false);
    expect(await getZestSbtcPosition("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N")).toBeNull();
  });
});
