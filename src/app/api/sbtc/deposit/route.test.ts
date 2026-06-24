import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/server/sbtc-pending");
import { POST } from "./route";
import * as sbtcPending from "@/lib/server/sbtc-pending";

const addPending = vi.mocked(sbtcPending.addPending).mockResolvedValue(undefined);

function req(body: unknown) {
  return new Request("http://x/api/sbtc/deposit", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/sbtc/deposit", () => {
  it("persists a valid deposit", async () => {
    const res = await POST(req({ txid: "a", stacksAddress: "SP1", amountSats: 100000, depositScript: "d", reclaimScript: "r" }));
    expect(res.status).toBe(201);
    expect(addPending).toHaveBeenCalledOnce();
    expect(addPending.mock.calls[0][0]).toMatchObject({ txid: "a", status: "broadcast" });
  });
  it("rejects a missing txid", async () => {
    const res = await POST(req({ stacksAddress: "SP1", amountSats: 100000 }));
    expect(res.status).toBe(400);
  });
});
