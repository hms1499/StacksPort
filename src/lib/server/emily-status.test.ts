import { describe, it, expect, vi, afterEach } from "vitest";
import { makeEmilyStatusClient } from "./emily-status";

afterEach(() => vi.restoreAllMocks());

describe("emily-status", () => {
  it("maps confirmed", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "confirmed" }), { status: 200 }));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("confirmed");
  });

  it("maps a 404 to unknown", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("unknown");
  });

  it("maps a network error to unknown", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("boom"));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("unknown");
  });
});
