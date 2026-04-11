import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("AI Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/ai");
  });

  test("renders Stacks AI title in topbar", async ({ page }) => {
    // Use h1 to avoid matching hidden sidebar label on mobile
    await expect(page.locator("h1").filter({ hasText: "Stacks AI" })).toBeVisible();
  });

  test("renders Market Intelligence header", async ({ page }) => {
    await expect(page.getByText("Market Intelligence").first()).toBeVisible();
  });

  test("renders refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();
  });

  test("renders sentiment card with data", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Market Sentiment" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Bullish/i)).toBeVisible();
  });

  test("renders trend analysis card", async ({ page }) => {
    await expect(page.getByText("Trend Analysis")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("STX").first()).toBeVisible();
  });

  test("renders smart alerts card", async ({ page }) => {
    await expect(page.getByText("Smart Alerts")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("STX breakout potential")).toBeVisible();
  });

  test("renders news digest card", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "News Digest" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("sBTC adoption accelerates")).toBeVisible();
  });

  test("shows updated timestamp", async ({ page }) => {
    await expect(page.getByText(/Updated/).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("AI Page - Error State", () => {
  test("shows error state when API fails", async ({ page }) => {
    await mockWalletConnected(page);
    // Mock AI API to return error
    await page.route("**/api/ai/insights", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );
    // Mock other APIs
    await page.route("**/api/coingecko/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
    await page.route("**/v2/accounts/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ balance: "0" }),
      })
    );
    await page.route("**/extended/v1/address/*/balances", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stx: { balance: "0" }, fungible_tokens: {} }),
      })
    );

    await page.goto("/ai");
    await expect(page.getByText("Failed to load insights")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
