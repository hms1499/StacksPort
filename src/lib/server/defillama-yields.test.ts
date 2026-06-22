import { describe, expect, it } from "vitest";
import { parseZestApy } from "./defillama-yields";

const sample = {
  data: [
    { chain: "Stacks", project: "zest-v2", symbol: "USDC", apy: 0.32 },
    { chain: "Stacks", project: "zest-v2", symbol: "sBTC", apy: 0.01 },
    { chain: "Stacks", project: "zest-v2", symbol: "STX", apy: 1.2 },
    { chain: "Stacks", project: "alex", symbol: "ALEX", apy: 9 },   // wrong project
    { chain: "Ethereum", project: "zest-v2", symbol: "USDC", apy: 5 }, // wrong chain
    { chain: "Stacks", project: "zest-v2", symbol: "USDH", apy: null }, // bad apy → skip
  ],
};

describe("parseZestApy", () => {
  it("keeps only Stacks zest-v2 pools, uppercased symbols, numeric apy", () => {
    expect(parseZestApy(sample)).toEqual({ USDC: 0.32, SBTC: 0.01, STX: 1.2 });
  });

  it("accepts a bare array as well as a { data } envelope", () => {
    expect(parseZestApy(sample.data)).toEqual({ USDC: 0.32, SBTC: 0.01, STX: 1.2 });
  });

  it("returns {} for unusable input", () => {
    expect(parseZestApy(null)).toEqual({});
    expect(parseZestApy({})).toEqual({});
  });
});
