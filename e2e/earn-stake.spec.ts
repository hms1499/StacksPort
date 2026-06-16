import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Earn — liquid stacking", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/assets");
  });

  test("stacking row opens the in-app stake modal", async ({ page }) => {
    // The "Put Your Assets to Work" yield card lists a Liquid Stacking row
    // whose action is now an in-app button (was an external stacking.club link).
    const stakingRow = page.locator("li").filter({ hasText: /Liquid Stacking/i }).first();
    await expect(stakingRow).toBeVisible({ timeout: 10_000 });

    await stakingRow.getByRole("button").first().click();

    // StakeStxModal title — messages → assets.stake.title
    await expect(page.getByText("Stake STX").first()).toBeVisible();
  });
});
