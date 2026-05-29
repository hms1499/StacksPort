// Deterministic fixtures served to E2E (Playwright) runs.
//
// Why this lives in a server module rather than in Playwright `page.route`
// mocks: the dashboard server-renders `getMarketSnapshot()` in an RSC
// (`src/app/dashboard/page.tsx`), and `getSTXPrice()` is called from server
// aggregators. Playwright only intercepts requests made by the *browser*, so
// it cannot mock fetches issued by the Next.js server process. The single
// `process.env.E2E === "1"` seam in the domain functions is the only place
// that can short-circuit those server-side reads.
//
// Keeping the fixtures here (loaded via dynamic import only when E2E=1) keeps
// the production aggregators free of test data and out of the prod hot path,
// and gives the mock STX price one source of truth shared across both seams.
import type { MarketSnapshot } from "@/lib/server/market-snapshot";

// Single source of truth for the mocked STX price across every E2E seam.
export const E2E_STX_PRICE = { usd: 1.25, usd_24h_change: 3.5 } as const;

export function e2eMarketSnapshot(): MarketSnapshot {
  const now = Date.now();
  const price = E2E_STX_PRICE.usd;
  const change24h = E2E_STX_PRICE.usd_24h_change;

  return {
    generatedAt: now,
    trending: [
      {
        id: "blockstack",
        symbol: "STX",
        name: "Stacks",
        priceUsd: price,
        change24h,
        image: "",
        sparkline: [1.05, 1.12, 1.18, price],
      },
    ],
    stxStats: {
      price,
      change24h,
      marketCap: 500_000_000,
      volume24h: 10_000_000,
    },
    stxHistory7d: {
      prices: [1.05, 1.1, 1.18, price],
      marketCaps: [420_000_000, 450_000_000, 480_000_000, 500_000_000],
      volumes: [7_000_000, 8_500_000, 9_250_000, 10_000_000],
    },
    pox: {
      currentCycleId: 101,
      cycleLength: 2100,
      rewardPhaseLength: 2000,
      preparePhaseLength: 100,
      blocksUntilNextCycle: 144,
      blocksUntilCycleEnd: 72,
      cycleProgressPct: 68,
      totalStackedUstx: 250_000_000_000_000,
      totalStackedSTX: 250_000_000,
      totalStackedUsd: 312_500_000,
      minThresholdSTX: 100_000,
      currentBurnHeight: 900_000,
      daysUntilNextCycle: 1,
    },
    fearGreed: { value: 65, classification: "Greed" },
    news: [
      {
        title: "Stacks ecosystem grows",
        url: "https://example.com/stacks-ecosystem",
        source: "CryptoNews",
        publishedAt: new Date(now).toISOString(),
        imageUrl: "",
      },
      {
        title: "sBTC reaches new milestone",
        url: "https://example.com/sbtc-milestone",
        source: "BlockchainToday",
        publishedAt: new Date(now - 3_600_000).toISOString(),
        imageUrl: "",
      },
    ],
    swapPrices: {
      blockstack: { usd: price },
      bitcoin: { usd: 65_000 },
      "sbtc-2": { usd: 65_000 },
    },
  };
}
