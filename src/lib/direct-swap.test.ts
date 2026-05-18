import { describe, it, expect } from "vitest";
import { PostConditionMode } from "@stacks/transactions";
import {
  buildSwapParams,
  toRawAmount,
  applySlippageFloor,
  amountForPercent,
  isQuoteStale,
  QUOTE_TTL_MS,
  minSwapHuman,
  isBelowMinSwap,
  computePriceImpact,
  sanitizeAmountInput,
  slippageWarning,
} from "./direct-swap";

describe("slippageWarning", () => {
  it("returns null for sensible slippage", () => {
    expect(slippageWarning(0.1)).toBeNull();
    expect(slippageWarning(0.5)).toBeNull();
    expect(slippageWarning(1)).toBeNull();
    expect(slippageWarning(5)).toBeNull(); // upper boundary still ok
    expect(slippageWarning(0.05)).toBeNull(); // lower boundary still ok
  });

  it("flags high slippage above 5%", () => {
    expect(slippageWarning(5.1)).toBe("high");
    expect(slippageWarning(20)).toBe("high");
  });

  it("flags too-low slippage below 0.05% (likely to fail)", () => {
    expect(slippageWarning(0.01)).toBe("low");
    expect(slippageWarning(0)).toBe("low");
  });
});

describe("sanitizeAmountInput", () => {
  it("keeps a plain decimal unchanged", () => {
    expect(sanitizeAmountInput("12.34", 6)).toBe("12.34");
    expect(sanitizeAmountInput("100", 6)).toBe("100");
  });

  it("strips letters, sign and exponent characters", () => {
    expect(sanitizeAmountInput("1e5", 6)).toBe("15");
    expect(sanitizeAmountInput("-1.5", 6)).toBe("1.5");
    expect(sanitizeAmountInput("12abc3", 6)).toBe("123");
    expect(sanitizeAmountInput("1,234.5", 6)).toBe("1234.5");
  });

  it("collapses multiple decimal points to the first one", () => {
    expect(sanitizeAmountInput("1.2.3", 6)).toBe("1.23");
  });

  it("truncates the fraction to the token decimals", () => {
    expect(sanitizeAmountInput("1.1234567", 6)).toBe("1.123456");
    expect(sanitizeAmountInput("0.123456789", 8)).toBe("0.12345678");
  });

  it("normalizes a leading dot", () => {
    expect(sanitizeAmountInput(".5", 6)).toBe("0.5");
    expect(sanitizeAmountInput(".", 6)).toBe("0.");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeAmountInput("", 6)).toBe("");
  });
});

describe("computePriceImpact", () => {
  it("is ~0 when the effective rate matches the reference (spot) rate", () => {
    // ref 1 → 10 (spot rate 10), actual 100 → 1000 (eff rate 10)
    expect(computePriceImpact(1, 10, 100, 1000)).toBeCloseTo(0, 10);
  });

  it("reports the fractional drop vs the spot rate", () => {
    // spot 10, actual 100 → 950 → eff 9.5 → impact 5%
    expect(computePriceImpact(1, 10, 100, 950)).toBeCloseTo(0.05, 10);
  });

  it("clamps to 0 when the effective rate is better than spot", () => {
    expect(computePriceImpact(1, 10, 100, 1100)).toBe(0);
  });

  it("returns 0 when the reference quote is unusable", () => {
    expect(computePriceImpact(0, 10, 100, 950)).toBe(0);
    expect(computePriceImpact(1, 0, 100, 950)).toBe(0);
    expect(computePriceImpact(1, 10, 0, 950)).toBe(0);
  });
});

describe("min-swap constraints", () => {
  it("exposes the contract minimums per source token", () => {
    expect(minSwapHuman("stx")).toBe(1); // 1 STX
    expect(minSwapHuman("sbtc")).toBe(0.00000334); // 334 sats
  });

  it("flags STX amounts below 1 STX", () => {
    expect(isBelowMinSwap("stx", "0.5")).toBe(true);
    expect(isBelowMinSwap("stx", "1")).toBe(false);
    expect(isBelowMinSwap("stx", "2.5")).toBe(false);
  });

  it("flags sBTC amounts below 334 sats", () => {
    expect(isBelowMinSwap("sbtc", "0.000001")).toBe(true); // 100 sats
    expect(isBelowMinSwap("sbtc", "0.00000334")).toBe(false); // exactly 334 sats
    expect(isBelowMinSwap("sbtc", "0.001")).toBe(false);
  });

  it("treats empty / zero input as below minimum", () => {
    expect(isBelowMinSwap("stx", "")).toBe(true);
    expect(isBelowMinSwap("sbtc", "0")).toBe(true);
  });
});

describe("isQuoteStale", () => {
  it("is fresh within the TTL", () => {
    expect(isQuoteStale(1000, 1000 + 10_000)).toBe(false);
  });

  it("is stale past the TTL", () => {
    expect(isQuoteStale(1000, 1000 + QUOTE_TTL_MS + 1)).toBe(true);
  });

  it("treats exactly TTL old as not yet stale", () => {
    expect(isQuoteStale(1000, 1000 + QUOTE_TTL_MS)).toBe(false);
  });
});

describe("amountForPercent", () => {
  it("returns the plain percentage when token is not native STX", () => {
    expect(amountForPercent(100, 0.5, false, 8)).toBe("50");
    expect(amountForPercent(100, 1, false, 8)).toBe("100"); // sBTC MAX, no reserve
  });

  it("returns the plain percentage for partial STX selections", () => {
    expect(amountForPercent(100, 0.5, true, 6)).toBe("50");
    expect(amountForPercent(100, 0.25, true, 6)).toBe("25");
  });

  it("reserves a gas buffer for STX MAX so the swap can pay fees", () => {
    expect(amountForPercent(100, 1, true, 6)).toBe("99.9"); // 100 - 0.1 reserve
  });

  it("returns 0 when STX balance is below the gas reserve", () => {
    expect(amountForPercent(0.05, 1, true, 6)).toBe("0");
  });

  it("rounds to at most 6 decimals", () => {
    expect(amountForPercent(10.123456, 0.25, false, 8)).toBe("2.530864");
  });
});

describe("toRawAmount", () => {
  it("converts whole and fractional human amounts to raw integer units", () => {
    expect(toRawAmount("1", 6)).toBe(1000000n);
    expect(toRawAmount("0.001", 8)).toBe(100000n);
    expect(toRawAmount(0.1, 8)).toBe(10000000n);
  });

  it("truncates fraction beyond token decimals (no rounding up)", () => {
    expect(toRawAmount("1.123456789", 6)).toBe(1123456n);
  });

  it("keeps full precision for large 8-decimal amounts (float would lose this)", () => {
    expect(toRawAmount("99999999.12345678", 8)).toBe(9999999912345678n);
  });

  it("handles empty / zero input as 0n", () => {
    expect(toRawAmount("", 6)).toBe(0n);
    expect(toRawAmount("0", 8)).toBe(0n);
  });
});

describe("applySlippageFloor", () => {
  it("reduces the raw amount by the slippage percent, flooring", () => {
    expect(applySlippageFloor(1000000n, 0.5)).toBe(995000n);
    expect(applySlippageFloor(1000000n, 1)).toBe(990000n);
    expect(applySlippageFloor(1000003n, 0.1)).toBe(999002n);
  });
});

const SENDER = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
const SBTC_ASSET = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token";

describe("buildSwapParams post-conditions", () => {
  it("STX → sBTC: Deny mode + exact uSTX outgoing post-condition from sender", () => {
    const p = buildSwapParams("stx", "sbtc", 1, 334, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "stx-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "1000000", // 1 STX, 6 decimals
    });
  });

  it("sBTC → STX: Deny mode + exact sBTC FT outgoing post-condition from sender", () => {
    const p = buildSwapParams("sbtc", "stx", 0.001, 1000000, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "100000", // 0.001 sBTC, 8 decimals
      asset: SBTC_ASSET,
    });
  });

  it("sBTC → USDCx (multi-hop router): Deny mode + exact sBTC FT outgoing post-condition from sender", () => {
    const p = buildSwapParams("sbtc", "usdcx", 0.01, 5000000, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "1000000", // 0.01 sBTC, 8 decimals
      asset: SBTC_ASSET,
    });
  });
});
