// e2e/sbtc-deposit.spec.ts
import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs, MOCK_STX_ADDRESS } from "./fixtures/test-utils";

// Minimum deposit = SBTC_DUST_SATS (10_000) + DEFAULT_MAX_SIGNER_FEE_SATS (80_000) = 90_000 sats
const BELOW_MIN = 100;
const ABOVE_MIN = 100_000;

/**
 * Mock the portfolio/snapshot endpoint to return a zero-balance sBTC snapshot.
 * SBTCMonitor only renders the "Get sBTC" button when sbtcData.balance === 0.
 */
async function mockPortfolioSnapshot(page: Parameters<typeof mockWalletConnected>[0]) {
  await page.route("**/api/portfolio/snapshot**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: Date.now(),
        address: MOCK_STX_ADDRESS,
        portfolio: { totalUsd: 156.25, stxBalance: 125, stxPrice: 1.25, change24h: 0 },
        fungibleTokens: { stx: { balance: "125000000", locked: "0" }, fungible_tokens: {} },
        tokensWithValues: {
          stx: {
            symbol: "STX",
            name: "Stacks",
            balance: 125,
            price: 1.25,
            valueUsd: 156.25,
            decimals: 6,
          },
          tokens: [],
          totalUsd: 156.25,
        },
        transactions: { results: [], total: 0, limit: 20, offset: 0 },
        dcaPlans: [],
        pnl: null,
        stackingStatus: null,
        sbtcData: {
          balance: 0,
          valueUsd: 0,
          peg: {
            btcPrice: 65000,
            sbtcPrice: 65000,
            deviation: 0,
            status: "pegged",
          },
          bridgeHistory: [],
        },
        limitOrders: [],
        zestSbtc: null,
      }),
    });
  });
}

test("Get sBTC modal validates the minimum and enables Review at above-minimum amount", async ({
  page,
}) => {
  // 1. Set up wallet + API mocks before page load
  await mockWalletConnected(page);
  await mockAPIs(page);
  await mockPortfolioSnapshot(page);

  // Also mock the sBTC deposits endpoint used inside the modal
  await page.route("**/api/sbtc/deposits**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deposits: [] }),
    })
  );

  // 2. Navigate to assets — lands on "Overview" tab by default
  await page.goto("/assets");

  // 3. Switch to the "Positions" tab where SBTCMonitor lives
  await page.getByRole("tab", { name: /Positions/i }).click();

  // 4. Wait for SBTCMonitor to render and show the "no sBTC" call-to-action button.
  //    Button text: t("noSbtcText") + " " + t("bridgeLink")
  //    = "You don't hold any sBTC yet.  Bridge BTC → sBTC"
  //    The → is a Unicode arrow; match on "Bridge BTC" substring.
  const getSbtcButton = page.getByRole("button", { name: /Bridge BTC/i });
  await expect(getSbtcButton).toBeVisible({ timeout: 15_000 });
  await getSbtcButton.click();

  // 5. The GetSbtcModal is a custom div overlay (not a dialog ARIA role).
  //    The amount input is labeled t("amountLabel") = "Amount to deposit (sats)"
  const amountInput = page.getByLabel(/Amount to deposit/i);
  await expect(amountInput).toBeVisible({ timeout: 5_000 });

  // 6. Enter an amount BELOW the minimum (90_000 sats) — expect the inline error
  await amountInput.fill(String(BELOW_MIN));
  // t("belowMin", { min: 90000 }) = "Minimum is 90000 sats (dust + signer fee)."
  await expect(page.getByText(/Minimum is/i)).toBeVisible();

  // 7. Enter an amount ABOVE the minimum — error clears, Review button becomes enabled
  await amountInput.fill(String(ABOVE_MIN));
  await expect(page.getByText(/Minimum is/i)).not.toBeVisible();

  // The Review button text is t("stepReview") = "Review" (when not busy)
  const reviewButton = page.getByRole("button", { name: /^Review$/i });
  await expect(reviewButton).toBeEnabled();

  // STOP HERE — do NOT click "Sign & send BTC" to avoid real BTC broadcast
});
