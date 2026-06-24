import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/server/sbtc-pending", () => ({
  listForAddress: vi.fn().mockResolvedValue([{ txid: "a" }]),
}));
import { GET } from "./route";

describe("GET /api/sbtc/deposits", () => {
  it("returns deposits for an address", async () => {
    const res = await GET(new Request("http://x/api/sbtc/deposits?address=SP1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deposits: [{ txid: "a" }] });
  });
  it("400s without address", async () => {
    const res = await GET(new Request("http://x/api/sbtc/deposits"));
    expect(res.status).toBe(400);
  });
});
