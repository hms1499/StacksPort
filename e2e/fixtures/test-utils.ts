import { type Page } from "@playwright/test";

// Mock wallet address (Stacks mainnet format)
export const MOCK_STX_ADDRESS = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const MOCK_BTC_ADDRESS = "bc1qtest1234567890abcdef";

/**
 * Inject connected wallet state into Zustand persisted store
 * before the page loads. This simulates a logged-in user.
 */
export async function mockWalletConnected(page: Page) {
  await page.addInitScript(
    ({ stxAddress, btcAddress }) => {
      const state = {
        state: {
          isConnected: true,
          stxAddress,
          btcAddress,
          network: "mainnet",
        },
        version: 0,
      };
      localStorage.setItem("stacks-wallet", JSON.stringify(state));
    },
    { stxAddress: MOCK_STX_ADDRESS, btcAddress: MOCK_BTC_ADDRESS }
  );
}

/**
 * Clear wallet state (guest mode).
 */
export async function mockWalletDisconnected(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("stacks-wallet");
  });
}

/**
 * Mock all external API routes to avoid real network calls.
 */
export async function mockAPIs(page: Page) {
  // Single handler for ALL CoinGecko API routes to avoid inter-route priority conflicts.
  // Branches internally on the URL path to return the correct data shape for each endpoint.
  await page.route("**/api/coingecko/**", (route) => {
    const url = route.request().url();
    const now = Date.now();

    if (url.includes("/market_chart")) {
      // getSTXMarketHistory / getSTXPriceHistory / getTokenMarketHistory
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          prices: [[now - 86400000, 1.2], [now, 1.25]],
          market_caps: [[now - 86400000, 480000000], [now, 500000000]],
          total_volumes: [[now - 86400000, 9000000], [now, 10000000]],
        }),
      });
    } else if (url.includes("/coins/markets")) {
      // getTrendingTokens - expects array of coin objects with sparklines
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "blockstack",
            symbol: "stx",
            name: "Stacks",
            image: "",
            current_price: 1.25,
            price_change_percentage_24h: 3.5,
            market_cap: 500000000,
            total_volume: 10000000,
            sparkline_in_7d: { price: [1.0, 1.1, 1.2, 1.25] },
            price_change_percentage_24h_in_currency: 3.5,
          },
        ]),
      });
    } else if (url.includes("/coins/blockstack")) {
      // getSTXMarketStats - expects market_data shape
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "blockstack",
          symbol: "stx",
          name: "Stacks",
          market_data: {
            current_price: { usd: 1.25 },
            price_change_percentage_24h: 3.5,
            market_cap: { usd: 500000000 },
            total_volume: { usd: 10000000 },
          },
        }),
      });
    } else {
      // simple/price and any other CoinGecko endpoints
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          blockstack: { usd: 1.25, usd_24h_change: 3.5 },
          bitcoin: { usd: 65000, usd_24h_change: 1.2 },
          "sbtc-2": { usd: 65000, usd_24h_change: 1.2 },
          stacks: { usd: 1.25, usd_24h_change: 3.5 },
        }),
      });
    }
  });

  // Bitflow token list
  await page.route("**/api/bitflow/tokens", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { symbol: "STX", name: "Stacks", decimals: 6 },
        { symbol: "sBTC", name: "sBTC", decimals: 8 },
      ]),
    })
  );

  // Bitflow swap quote
  await page.route("**/api/bitflow/quote**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ amountOut: 1500, route: "STX -> sBTC" }),
    })
  );

  // Stableswap quote
  await page.route("**/api/stableswap/quote**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ amountOut: 100 }),
    })
  );

  // News
  // /api/news returns a NewsItem[] array directly (no wrapper object)
  await page.route("**/api/news", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          title: "Stacks ecosystem grows",
          url: "https://example.com/1",
          source: "CryptoNews",
          publishedAt: new Date().toISOString(),
          imageUrl: "",
        },
        {
          title: "sBTC reaches new milestone",
          url: "https://example.com/2",
          source: "BlockchainToday",
          publishedAt: new Date().toISOString(),
          imageUrl: "",
        },
      ]),
    })
  );

  // AI insights - matches AIInsightsResponse type exactly
  await page.route("**/api/ai/insights", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sentiment: {
          score: 45,
          fearGreedValue: 65,
          summary: "Market sentiment is positive with strong buying pressure.",
          signals: [
            { label: "Volume spike", type: "bullish" },
            { label: "RSI overbought", type: "bearish" },
          ],
        },
        trends: {
          summary: "STX showing upward momentum with increasing volume.",
          tokens: [
            {
              symbol: "STX",
              direction: "up",
              insight: "Breaking above key resistance at $1.30",
              changePercent: 5.2,
            },
            {
              symbol: "sBTC",
              direction: "up",
              insight: "Following BTC trend closely",
              changePercent: 2.1,
            },
          ],
        },
        alerts: {
          items: [
            {
              type: "opportunity",
              title: "STX breakout potential",
              description: "Price approaching key resistance level.",
              priority: "high",
            },
          ],
        },
        newsDigest: {
          summary: "Positive developments in the Stacks ecosystem.",
          items: [
            {
              headline: "sBTC adoption accelerates",
              insight: "More protocols integrating sBTC for DeFi use cases.",
              source: "StacksNews",
              url: "https://example.com/sbtc-adoption",
            },
          ],
        },
        generatedAt: new Date().toISOString(),
      }),
    })
  );

  // Hiro Stacks API - account balance
  await page.route("**/v2/accounts/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: "125000000",
        nonce: 10,
        stx: { balance: "125000000", locked: "0" },
      }),
    })
  );

  // Hiro Stacks API - address balances (fungible tokens)
  await page.route("**/extended/v1/address/*/balances", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stx: { balance: "125000000", locked: "0" },
        fungible_tokens: {},
      }),
    })
  );

  // Hiro Stacks API - address transactions
  await page.route("**/extended/v1/address/*/transactions**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [], total: 0, limit: 20, offset: 0 }),
    })
  );

  // Hiro Stacks API - contract read-only calls (DCA vaults)
  await page.route("**/v2/contracts/call-read/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ okay: true, result: "0x0100000000000000000000000000000000" }),
    })
  );

  // Telegram bot API
  await page.route("**/api/telegram**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  );

  // Fear & Greed Index (alternative.me)
  await page.route("**/fng/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ value: "65", value_classification: "Greed", timestamp: Date.now().toString() }],
      }),
    })
  );

  // CoinGecko trending
  await page.route("**/api/v3/search/trending**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        coins: [
          {
            item: {
              id: "stacks",
              name: "Stacks",
              symbol: "STX",
              thumb: "",
              data: { price: 1.25, price_change_percentage_24h: { usd: 3.5 } },
            },
          },
        ],
      }),
    })
  );
}
