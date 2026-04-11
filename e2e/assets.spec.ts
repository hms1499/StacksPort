import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Assets Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/assets");
  });

  test("renders My Assets page title in topbar", async ({ page }) => {
    // Use h1 to avoid matching hidden sidebar label on mobile
    await expect(page.locator("h1").filter({ hasText: "My Assets" })).toBeVisible();
  });

  test("renders portfolio summary section", async ({ page }) => {
    // PortfolioSummary renders "Net Worth" when connected and data is loaded
    await expect(page.getByText("Net Worth").first()).toBeVisible({ timeout: 10000 });
  });

  test("renders health score section", async ({ page }) => {
    await expect(page.getByText(/Health|Score/i).first()).toBeVisible();
  });

  test("renders token holdings section", async ({ page }) => {
    // Scope to main to avoid matching hidden sidebar "My Assets" label on mobile
    await expect(page.locator("main").getByText(/Holdings|Tokens|Assets/i).first()).toBeVisible();
  });

  test("renders PnL tracker section", async ({ page }) => {
    await expect(page.getByText(/PnL|Profit|Loss/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("renders stacking tracker section", async ({ page }) => {
    await expect(page.getByText(/Stacking/i).first()).toBeVisible();
  });

  test("renders sBTC monitor section", async ({ page }) => {
    await expect(page.getByText(/sBTC/i).first()).toBeVisible();
  });

  test("renders transaction history section", async ({ page }) => {
    await expect(page.getByText(/Transaction|History|Activity/i).first()).toBeVisible();
  });

  test("page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(
      (e) => e.includes("React") || e.includes("Hydration")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
