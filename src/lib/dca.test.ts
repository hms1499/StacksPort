import { describe, it, expect } from "vitest";
import {
  microToToken,
  tokenToMicro,
  microToSTX,
  stxToMicro,
} from "./dca";

describe("microToToken", () => {
  it("converts micro to token at default 6 decimals", () => {
    expect(microToToken(1_500_000)).toBe(1.5);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(microToToken(150_000_000, 8)).toBe(1.5);
  });
  it("returns 0 for 0", () => {
    expect(microToToken(0)).toBe(0);
  });
  it("represents a single micro-unit at 6dp", () => {
    expect(microToToken(1)).toBeCloseTo(0.000001, 12);
  });
});

describe("tokenToMicro", () => {
  it("converts token to micro at default 6 decimals", () => {
    expect(tokenToMicro(1.5)).toBe(1_500_000);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(tokenToMicro(1.5, 8)).toBe(150_000_000);
  });
  // CHARACTERIZED: Math.floor drops sub-micro dust (0.0000005 STX -> 0).
  it("floors sub-micro amounts to zero (dust loss)", () => {
    expect(tokenToMicro(0.0000005)).toBe(0);
  });
  it("round-trips with microToToken", () => {
    expect(microToToken(tokenToMicro(2.5))).toBe(2.5);
  });
});

describe("microToSTX / stxToMicro", () => {
  it("microToSTX converts at 6 decimals", () => {
    expect(microToSTX(2_000_000)).toBe(2);
  });
  it("stxToMicro converts at 6 decimals", () => {
    expect(stxToMicro(2)).toBe(2_000_000);
  });
  it("round-trips", () => {
    expect(microToSTX(stxToMicro(3.25))).toBe(3.25);
  });
});
