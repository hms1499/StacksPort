import { describe, it, expect } from "vitest";
import { summarizeStackingPosition } from "./position";

describe("summarizeStackingPosition", () => {
  it("values a liquid-only position via the exchange rate", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: 1_100_000, // 1 stSTX = 1.1 STX
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 11, poxStx: 0, totalStx: 11, isEarning: true });
  });

  it("reports a PoX-only position as earning", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 500,
      poxIsStacking: true,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 500, totalStx: 500, isEarning: true });
  });

  it("sums liquid and PoX when both are present", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: 1_000_000,
      poxLockedStx: 200,
      poxIsStacking: true,
    });
    expect(s).toEqual({ liquidStx: 10, poxStx: 200, totalStx: 210, isEarning: true });
  });

  it("is not earning when nothing is staked", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 0, totalStx: 0, isEarning: false });
  });

  it("returns null liquid value when stSTX is held but the rate is unavailable", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: null,
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: null, poxStx: 0, totalStx: 0, isEarning: true });
  });

  it("ignores PoX locked STX when PoX is not active", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 999,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 0, totalStx: 0, isEarning: false });
  });
});
