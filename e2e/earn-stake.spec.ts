import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Earn — liquid stacking", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/earn");
  });

  test("stacking row opens the in-app stake modal", async ({ page }) => {
    // The yield card lists a Liquid Stacking row whose action is an in-app button.
    const stakingRow = page.locator("li").filter({ hasText: /Liquid Stacking/i }).first();
    await expect(stakingRow).toBeVisible({ timeout: 10_000 });

    await stakingRow.getByRole("button").first().click();

    // StakeStxModal title — messages → assets.stake.title
    await expect(page.getByText("Stake STX").first()).toBeVisible();
  });

  test("the earn page is reachable", async ({ page }) => {
    // Landing directly on /earn renders the hub (Topbar title from earn.title).
    await expect(page.getByText("Earn").first()).toBeVisible({ timeout: 10_000 });
  });
});
