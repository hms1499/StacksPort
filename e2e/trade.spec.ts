import { test, expect } from "@playwright/test";
import {
  mockWalletConnected,
  mockWalletDisconnected,
  mockAPIs,
} from "./fixtures/test-utils";

test.describe("Trade Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/trade");
  });

  test("renders Trade page with Swap section", async ({ page }) => {
    // The heading "Swap" is an h2 in the trade page wrapper
    await expect(page.locator("h2").filter({ hasText: "Swap" }).first()).toBeVisible();
  });

  test("renders from token selector with default token", async ({ page }) => {
    await expect(page.getByText("From").first()).toBeVisible();
    await expect(page.getByText("STX").first()).toBeVisible();
  });

  test("renders to token selector", async ({ page }) => {
    // "To" label inside the SimpleTokenSelector
    await expect(page.locator("p").filter({ hasText: /^To$/ })).toBeVisible();
  });

  test("renders amount input", async ({ page }) => {
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible();
    await expect(amountInput).toHaveAttribute("placeholder", "0.00");
  });

  test("amount input accepts numeric values", async ({ page }) => {
    const amountInput = page.locator('input[type="number"]').first();
    // pressSequentially is more reliable than fill() for number inputs on mobile/iOS
    await amountInput.pressSequentially("100");
    await expect(amountInput).toHaveValue("100");
  });

  test("renders flip button", async ({ page }) => {
    // The flip button contains ArrowDownUp icon - there may be 2 (swap + migration), pick first
    const flipSection = page.locator(".flex.justify-center");
    await expect(flipSection.locator("button").first()).toBeVisible();
  });

  test("renders swap button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Select tokens|Swap/i })).toBeVisible();
  });

  test("swap button is disabled when no amount entered", async ({ page }) => {
    const swapButton = page.getByRole("button", { name: /Select tokens|Swap/i });
    await expect(swapButton).toBeDisabled();
  });

  test("renders balance percentage shortcuts (25%, 50%, MAX)", async ({ page }) => {
    await expect(page.getByRole("button", { name: "25%" })).toBeVisible();
    await expect(page.getByRole("button", { name: "50%" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MAX" })).toBeVisible();
  });

  test("renders You receive section", async ({ page }) => {
    await expect(page.getByText("You receive (estimated)")).toBeVisible();
  });

  test("renders Powered by Bitflow", async ({ page }) => {
    await expect(page.getByText("Powered by").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Bitflow Pools" })).toBeVisible();
  });

  test("renders migration widget section", async ({ page }) => {
    await expect(
      page.locator("h2").filter({ hasText: /Migration/ })
    ).toBeVisible();
  });

  test("renders info panels", async ({ page }) => {
    await expect(page.locator("h3").filter({ hasText: "Best Routes" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Real Yield" })).toBeVisible();
  });

  test("renders swap tips", async ({ page }) => {
    await expect(page.locator("h3").filter({ hasText: "Swap Tips" })).toBeVisible();
    await expect(page.getByText(/Set slippage to 0.5%/)).toBeVisible();
  });
});

test.describe("Trade Page (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletDisconnected(page);
    await mockAPIs(page);
    await page.goto("/trade");
  });

  test("shows connect wallet message when not connected", async ({ page }) => {
    await expect(page.getByText("Connect your wallet to swap")).toBeVisible();
  });

  test("swap button is disabled for guest", async ({ page }) => {
    const swapButton = page.getByRole("button", { name: /Select tokens|Swap/i });
    await expect(swapButton).toBeDisabled();
  });
});
