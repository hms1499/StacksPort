import { test, expect } from "@playwright/test";
import {
  mockWalletConnected,
  mockWalletDisconnected,
  mockAPIs,
} from "./fixtures/test-utils";

test.describe("Limit Orders", () => {
  test("renders the limit-order section on /trade", async ({ page }) => {
    await mockWalletDisconnected(page);
    await mockAPIs(page);
    await page.goto("/trade");
    await expect(page.getByRole("heading", { name: /Limit Orders/i })).toBeVisible();
  });

  test("create form validates and enables with a connected wallet", async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/trade");
    await page.getByPlaceholder("2.0").fill("5");
    await page.getByPlaceholder("60000").fill("60000");
    await expect(
      page.getByRole("button", { name: /Create limit order/i })
    ).toBeEnabled();
  });
});
