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

test.describe("DCA Out — STX→USDCx create plan", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/dca");
  });

  test("shows STX source toggle in DCA Out tab", async ({ page }) => {
    await page.getByRole("tab", { name: /DCA Out/i }).click();
    // OutSourceToggle renders a tablist with "Sell sBTC" and "Sell STX" buttons
    await expect(
      page.getByRole("tab", { name: /Sell STX/i })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Sell sBTC/i })
    ).toBeVisible();
  });

  test("STX source toggle switches to STX out form", async ({ page }) => {
    await page.getByRole("tab", { name: /DCA Out/i }).click();
    await page.getByRole("tab", { name: /Sell STX/i }).click();
    // The form h2 heading is visible on desktop (always rendered on lg+).
    // Use role=heading to avoid matching the mobile collapsible button label.
    await expect(
      page.getByRole("heading", { name: "Create STX→USDCx DCA Plan" })
    ).toBeVisible({ timeout: 8000 });
  });

  test("creates STX→USDCx plan — reaches signing path", async ({ page }) => {
    // 1. Switch to DCA Out tab
    await page.getByRole("tab", { name: /DCA Out/i }).click();

    // 2. Select STX as source
    await page.getByRole("tab", { name: /Sell STX/i }).click();

    // 3. On mobile the form is collapsed behind a disclosure button; open it if
    //    the button is visible (it is hidden on lg+ via CSS).
    const mobileToggle = page
      .locator("button[aria-expanded]")
      .filter({ hasText: /STX.*USDCx|Create STX/i });
    if (await mobileToggle.isVisible()) {
      await mobileToggle.click();
    }

    // 4. Wait for the form to be present and inputs to be interactive.
    //    There are two number inputs: amount-per-swap (min 1) and initial-deposit (min 2).
    //    Scope to the glass-card div that contains the h2 form heading so we
    //    don't accidentally target the mobile-collapsible button with a similar label.
    const formCard = page.locator("div.glass-card").filter({
      has: page.getByRole("heading", { name: "Create STX→USDCx DCA Plan" }),
    });

    // amount per swap (first number input in the form card)
    const amountInput = formCard.locator('input[type="number"]').first();
    await amountInput.waitFor({ state: "visible", timeout: 8000 });
    await amountInput.fill("10");

    // initial deposit (second number input)
    const depositInput = formCard.locator('input[type="number"]').nth(1);
    await depositInput.fill("20");

    // 5. Pick "Weekly" interval (it is the default, but explicitly click for clarity)
    await page.getByRole("button", { name: "Weekly" }).first().click();

    // 6. Submit — the button is enabled when amount ≥ 1 and deposit ≥ 2.
    const createBtn = formCard.getByRole("button", { name: /Create Plan/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // 7. The form calls createStxUsdcxPlan → openContractCall. The loading
    //    state is set synchronously before the wallet call, so the button text
    //    changes to "Waiting for wallet…". This is the signing-path signal.
    await expect(
      formCard.getByRole("button", { name: /Waiting for wallet/i })
    ).toBeVisible({ timeout: 5000 });
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
