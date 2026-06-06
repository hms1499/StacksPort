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

  test("mobile first viewport shows hero value prop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator("h1")).toBeInViewport();
    await expect(page.getByRole("button", { name: /Launch App/i })).toBeInViewport();
    await expect(page.getByText("Live on Stacks Mainnet")).toBeInViewport();
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
    await expect(page.getByText("Non-custodial", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open-source contracts" })).toHaveAttribute(
      "href",
      /github\.com\/hms1499\/StacksPort\/tree\/main\/contracts/
    );
    await expect(page.getByText("Audited contracts")).toHaveCount(0);
  });

  test("renders hero feature highlights", async ({ page }) => {
    // The old hard-coded stats strip was removed in favor of feature cards.
    // Assert the hero CTA + at least one trust badge are visible — these are
    // load-bearing for the landing's first impression.
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByText(/Non-custodial|Audited contracts|Stacks mainnet/).first()
    ).toBeVisible();
  });

  test("labels hero product values as preview data", async ({ page }) => {
    await expect(page.getByText("Portfolio Preview")).toBeVisible();
    await expect(page.getByText("Preview executions")).toBeVisible();
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

  test("renders verifiable protocol trust details", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Built for transparent automation" })
    ).toBeVisible();
    await expect(page.getByText("0.3% protocol fee", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "STX to sBTC vault on Stacks Explorer" })
    ).toHaveAttribute("href", /dca-vault-v2\?chain=mainnet$/);
    await expect(
      page.getByRole("link", { name: "sBTC to USDCx vault on Stacks Explorer" })
    ).toHaveAttribute("href", /dca-vault-sbtc-v2\?chain=mainnet$/);
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
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="#"]')).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Twitter" })).toHaveCount(0);
  });
});
