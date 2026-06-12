// src/lib/server/chat-context.test.ts
import { describe, it, expect } from "vitest";
import { buildChatContext } from "./chat-context";
import type { MarketSnapshot } from "./market-snapshot";
import type { PortfolioSnapshot } from "./portfolio-snapshot";

const market: MarketSnapshot = {
  generatedAt: 0,
  trending: [
    { id: "x", symbol: "ALEX", name: "Alex", priceUsd: 0.1, change24h: 5, image: "", sparkline: [] },
    { id: "y", symbol: "WELSH", name: "Welsh", priceUsd: 0.001, change24h: -3, image: "", sparkline: [] },
  ],
  stxStats: { price: 1.85, change24h: 4.2, marketCap: 2_800_000_000, volume24h: 90_000_000 },
  stxHistory7d: { prices: [1.7, 1.85], marketCaps: [], volumes: [] },
  pox: null,
  fearGreed: { value: 31, classification: "Fear" },
  news: [],
  swapPrices: { bitcoin: { usd: 95000 } },
};

const portfolio: PortfolioSnapshot = {
  generatedAt: 0,
  address: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
  portfolio: {
    totalUSD: 1234.5, stxUSD: 1000, otherUSD: 234.5, stackingUSD: 0,
    stxBalance: 0, stxHumanBalance: 540, stxPrice: 1.85, stxChange24h: 4.2,
    geckoTokens: [], fixedTokens: [], fixedValueUSD: 0,
  },
  fungibleTokens: null,
  tokensWithValues: null,
  transactions: null,
  dcaPlans: [
    { id: 7, owner: "SP", token: "SP.token-sbtc", amt: 5_000_000, ivl: 4550, leb: 0, bal: 25_000_000, tsd: 3, tss: 15_000_000, active: true, cat: 0 },
  ],
  pnl: {
    entries: [
      { contractId: "c", symbol: "ALEX", name: "Alex", imageUri: undefined, currentBalance: 100, currentPrice: 0.1, currentValue: 10, avgCostBasis: 0.05, totalCost: 5, unrealizedPnL: 5, unrealizedPct: 100, realizedPnL: 0, totalPnL: 5 },
    ],
    totalUnrealized: 5, totalRealized: 0, totalPnL: 5,
  },
  stackingStatus: null,
  sbtcData: null,
};

describe("buildChatContext", () => {
  it("includes market facts with real numbers", () => {
    const out = buildChatContext(market, null);
    expect(out).toContain("1.85");        // STX price
    expect(out).toContain("31");          // fear & greed value
    expect(out).toContain("Fear");        // classification
    expect(out).toContain("95000");       // BTC price
    expect(out).toContain("ALEX");        // trending symbol
  });

  it("notes portfolio is unavailable when no wallet is connected", () => {
    const out = buildChatContext(market, null);
    expect(out.toLowerCase()).toContain("no wallet");
  });

  it("includes portfolio facts when a wallet is connected", () => {
    const out = buildChatContext(market, portfolio);
    expect(out).toContain("1234.5");      // total USD
    expect(out).toContain("#7");          // DCA plan id
    expect(out).toContain("Weekly");      // ivl 4550 -> Weekly
    expect(out).toContain("ALEX");        // pnl entry symbol
  });

  it("degrades missing fields to N/A without throwing", () => {
    const bare: MarketSnapshot = { ...market, stxStats: null, fearGreed: null, trending: null, swapPrices: {} };
    expect(() => buildChatContext(bare, null)).not.toThrow();
    expect(buildChatContext(bare, null)).toContain("N/A");
  });
});
