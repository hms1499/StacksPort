import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Notifications Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/notifications");
  });

  test("renders Notifications page", async ({ page }) => {
    // Page should load without crash
    await expect(page.locator("main")).toBeVisible();
  });

  test("renders filter tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Transactions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alerts", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "DCA", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wallet", exact: true })).toBeVisible();
  });

  test("All tab is active by default", async ({ page }) => {
    const allTab = page.getByRole("button", { name: "All", exact: true });
    // Active tab has border-[#408A71] class
    await expect(allTab).toHaveClass(/border-\[#408A71\]/);
  });

  test("renders search input", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Search notifications...")
    ).toBeVisible();
  });

  test("renders sort button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Sort/i })).toBeVisible();
  });

  test("shows empty state when no notifications", async ({ page }) => {
    // EmptyState renders with font-semibold class, use role to disambiguate
    await expect(
      page.locator("p.text-base").filter({ hasText: "No notifications yet" })
    ).toBeVisible();
    await expect(
      page.getByText(/Notifications will appear here/)
    ).toBeVisible();
  });

  test("clicking filter tabs switches active state", async ({ page }) => {
    const transactionsTab = page.getByRole("button", { name: "Transactions", exact: true });
    await transactionsTab.click();
    await expect(transactionsTab).toHaveClass(/border-\[#408A71\]/);
  });

  test("search input accepts text", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search notifications...");
    await searchInput.fill("swap");
    await expect(searchInput).toHaveValue("swap");
  });

  test("sort dropdown opens on click", async ({ page }) => {
    await page.getByRole("button", { name: /Sort/i }).click();
    await expect(page.getByText("Newest first")).toBeVisible();
    await expect(page.getByText("Oldest first")).toBeVisible();
  });
});
