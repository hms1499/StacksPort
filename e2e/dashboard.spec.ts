import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Dashboard Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/dashboard");
  });

  test("renders page with Dashboard title in topbar", async ({ page }) => {
    // Use h1 to avoid matching hidden sidebar "Dashboard" label on mobile
    await expect(page.locator("h1").filter({ hasText: "Dashboard" })).toBeVisible();
  });

  test("renders wallet banner", async ({ page }) => {
    // Connected state shows wallet avatar in topbar (rounded-full, always visible)
    await expect(page.locator("header .rounded-full").first()).toBeVisible();
  });

  test("renders balance card section", async ({ page }) => {
    await expect(page.getByText(/Portfolio|Balance|Total/i).first()).toBeVisible();
  });

  test("renders quick actions when connected", async ({ page }) => {
    // Scope to main to avoid sidebar nav items (Swap, DCA Vault) hidden on mobile
    const quickActions = page.locator("main").getByText(/Send|Receive|Swap|DCA/i).first();
    await expect(quickActions).toBeVisible();
  });

  test("renders market stats section", async ({ page }) => {
    await expect(page.getByText(/STX|Price|Market/i).first()).toBeVisible();
  });

  test("renders trending tokens section", async ({ page }) => {
    await expect(page.getByText(/Trending/i).first()).toBeVisible();
  });

  test("renders crypto news section", async ({ page }) => {
    await expect(page.getByText(/News/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("renders recent activity section", async ({ page }) => {
    await expect(page.getByText(/Recent|Activity/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("page is scrollable", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    // Main content area is the overflow-y-auto div inside the layout
    const scrollArea = page.locator(".overflow-y-auto").first();
    await expect(scrollArea).toBeVisible();
    const scrollHeight = await scrollArea.evaluate((el) => el.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(0);
  });
});
