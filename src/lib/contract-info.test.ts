import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContractInfo } from "@/lib/stacks";

describe("fetchContractInfo", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sourceVerified: true when source_code is non-null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_code: "(define-public ...)" }),
    } as Response);
    const result = await fetchContractInfo("SP123.my-contract");
    expect(result).toEqual({ sourceVerified: true });
  });

  it("returns sourceVerified: false when source_code is null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_code: null }),
    } as Response);
    const result = await fetchContractInfo("SP123.my-contract");
    expect(result).toEqual({ sourceVerified: false });
  });

  it("throws when response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(fetchContractInfo("SP123.my-contract")).rejects.toThrow(
      "Failed to fetch contract info"
    );
  });
});
