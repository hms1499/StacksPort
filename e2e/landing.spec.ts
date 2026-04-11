import { test, expect } from "@playwright/test";
import { mockWalletDisconnected } from "./fixtures/test-utils";

test.describe("Landing Page (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletDisconnected(page);
    await page.goto("/");
  });

  test("renders hero section with title and CTA", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Smart Portfolio");
    await expect(page.locator("h1")).toContainText("for Stacks");
    await expect(page.getByRole("button", { name: /Launch App/i })).toBeVisible();
  });

  test("renders Live on Stacks Mainnet badge", async ({ page }) => {
    await expect(page.getByText("Live on Stacks Mainnet")).toBeVisible();
  });

  test("renders subtitle description", async ({ page }) => {
    await expect(
      page.getByText(/Automate DCA plans, execute instant swaps/)
    ).toBeVisible();
  });

  test("renders See Features link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /See Features/i })).toBeVisible();
  });

  test("renders trust badges", async ({ page }) => {
    // Trust badges are in the hero section (hidden on small viewports via lg:block parent)
    const badges = page.locator("text=Non-custodial, text=Audited contracts, text=Stacks mainnet");
    // At least the hero copy section is visible
    await expect(page.getByText(/Non-custodial|Audited contracts|Stacks mainnet/).first()).toBeVisible();
  });

  test("renders stats strip with 4 items", async ({ page }) => {
    await expect(page.getByText("847+")).toBeVisible();
    await expect(page.getByText("$2.1M")).toBeVisible();
    await expect(page.getByText("1,200+")).toBeVisible();
    await expect(page.getByText("+18.4%")).toBeVisible();
  });

  test("renders 6 feature cards", async ({ page }) => {
    const features = [
      "DCA Automation",
      "Instant Swaps",
      "Portfolio Analytics",
      "Smart Alerts",
      "Non-Custodial",
      "AI Insights",
    ];
    for (const feature of features) {
      await expect(page.getByRole("heading", { name: feature })).toBeVisible();
    }
  });

  test("renders how-it-works section with 3 steps", async ({ page }) => {
    await expect(page.getByText("Three steps to automate")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a DCA plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Let the bot execute" })).toBeVisible();
  });

  test("renders CTA section with Connect Wallet button", async ({ page }) => {
    await expect(page.getByText("Start investing")).toBeVisible();
    // There are 2 Connect Wallet buttons (navbar + CTA), check the CTA one
    const ctaSection = page.locator("section").filter({ hasText: "Start investing" });
    await expect(ctaSection.getByRole("button", { name: /Connect Wallet/i })).toBeVisible();
  });

  test("renders navbar", async ({ page }) => {
    await expect(page.locator("nav").first()).toBeVisible();
  });

  test("renders footer", async ({ page }) => {
    await expect(page.locator("footer")).toBeVisible();
  });
});
