import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Avoid the real invalidate network call.
vi.mock("@/lib/invalidate", () => ({ invalidatePortfolio: vi.fn() }));

import { trackTx } from "./tx-tracker";

describe("trackTx onResolved", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("calls onResolved('success') when the tx confirms", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ tx_status: "success" }),
    })));
    const onResolved = vi.fn();
    const addNotification = vi.fn();

    trackTx({ txId: "0xabc", label: "Supply", category: "wallet", addNotification, onResolved });

    // Initial 15s delay then first poll.
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onResolved).toHaveBeenCalledWith("success");
    expect(addNotification).toHaveBeenCalled();
  });

  it("calls onResolved('failed') on abort", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ tx_status: "abort_by_post_condition" }),
    })));
    const onResolved = vi.fn();

    trackTx({ txId: "0xdef", label: "Supply", category: "wallet", addNotification: vi.fn(), onResolved });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onResolved).toHaveBeenCalledWith("failed");
  });
});
