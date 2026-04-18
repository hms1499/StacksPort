import { test, expect } from "@playwright/test";
import {
  mockWalletConnected,
  mockWalletDisconnected,
  mockAPIs,
} from "./fixtures/test-utils";

test.describe("DCA Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/dca");
  });

  test("renders DCA Vault page title", async ({ page }) => {
    await expect(
      page.locator("[data-dca-hero]").getByRole("heading", { name: "DCA Vault" })
    ).toBeVisible();
  });

  test("renders DCA In/Out tab navigator", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /DCA In/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /DCA Out/i })).toBeVisible();
  });

  test("DCA In tab is active by default", async ({ page }) => {
    const dcaInButton = page.getByRole("tab", { name: /DCA In/i });
    await expect(dcaInButton).toHaveAttribute("aria-selected", "true");
  });

  test("renders description for DCA In", async ({ page }) => {
    await expect(
      page.getByText(/Automatically buy sBTC on a schedule with STX/)
    ).toBeVisible();
  });

  test("switching to DCA Out tab updates content", async ({ page }) => {
    await page.getByRole("tab", { name: /DCA Out/i }).click();
    await expect(
      page.getByText(/Automatically sell sBTC for USDCx/)
    ).toBeVisible();
  });

  test("renders hero stats section", async ({ page }) => {
    await expect(page.locator("[data-dca-hero]")).toBeVisible();
    await expect(page.getByText(/Total Volume|Swaps Executed/i).first()).toBeVisible();
  });

  test("renders create plan form when connected", async ({ page }) => {
    // Scope to main to avoid hidden sidebar elements on mobile
    await expect(page.locator("main").locator("form, [class*='rounded']").first()).toBeVisible();
  });

  test("renders info footer cards", async ({ page }) => {
    // Info footer cards contain these specific descriptions
    await expect(page.getByText("Dollar-Cost Averaging").first()).toBeVisible();
    await expect(page.getByText("0.3% Protocol Fee").first()).toBeVisible();
    // "Non-custodial" in DCA info footer
    await expect(page.getByText(/STX is held directly in the smart contract/).first()).toBeVisible();
  });

  test("DCA Out tab shows different info footer", async ({ page }) => {
    await page.getByRole("tab", { name: /DCA Out/i }).click();
    await expect(page.getByText("Dollar-Cost Averaging Out")).toBeVisible();
    await expect(page.getByText("3-Hop Swap", { exact: true })).toBeVisible();
  });
});

test.describe("DCA Page (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletDisconnected(page);
    await mockAPIs(page);
    await page.goto("/dca");
    // DCA page uses dynamic import (ssr: false), wait for client render
    await page.waitForLoadState("networkidle");
  });

  test("shows connect wallet empty state for guest", async ({ page }) => {
    await expect(
      page.getByText("Connect your wallet to get started")
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows wallet description for guest", async ({ page }) => {
    await expect(
      page.getByText(/Connect a Leather or Xverse wallet/)
    ).toBeVisible({ timeout: 10000 });
  });
});
