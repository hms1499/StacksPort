import { test, expect } from "@playwright/test";
import { mockWalletDisconnected } from "./fixtures/test-utils";

test.describe("Landing Page (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletDisconnected(page);
    await page.goto("/");
  });

  test("renders hero section with title and CTA", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Automate your");
    await expect(page.locator("h1")).toContainText("Bitcoin strategy");
    await expect(page.getByRole("button", { name: /Connect wallet/i }).first()).toBeVisible();
  });

  test("mobile first viewport shows hero value prop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator("h1")).toBeInViewport();
    await expect(page.getByRole("button", { name: /Connect wallet/i }).first()).toBeInViewport();
    await expect(page.getByText("Live on Stacks Mainnet")).toBeInViewport();
  });

  test("renders Live on Stacks Mainnet badge", async ({ page }) => {
    await expect(page.getByText("Live on Stacks Mainnet")).toBeVisible();
  });

  test("renders subtitle description", async ({ page }) => {
    await expect(
      page.getByText(/Turn STX into sBTC on a schedule you control/)
    ).toBeVisible();
  });

  test("renders read-only dashboard link", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Explore dashboard" }).first()
    ).toHaveAttribute("href", "/dashboard");
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

  test("renders the product walkthrough", async ({ page }) => {
    const sections = [
      "Build an STX to sBTC schedule",
      "Track cost basis and plan runway",
      "Swap directly and stay informed",
    ];
    for (const section of sections) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }
    await expect(page.getByText("Preview portfolio", { exact: false })).toBeVisible();
  });

  test("renders how-it-works section with 3 steps", async ({ page }) => {
    await expect(page.getByText("Three steps to automate")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a DCA plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Let the bot execute" })).toBeVisible();
  });

  test("renders verifiable protocol trust details", async ({ page }) => {
    const trustSection = page.locator("#security");
    await expect(
      trustSection.getByRole("heading", { name: "Built for transparent automation" })
    ).toBeVisible();
    await expect(
      trustSection.getByText("0.3% protocol fee", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "STX to sBTC vault on Stacks Explorer" })
    ).toHaveAttribute("href", /dca-vault-v2\?chain=mainnet$/);
    await expect(
      page.getByRole("link", { name: "sBTC to USDCx vault on Stacks Explorer" })
    ).toHaveAttribute("href", /dca-vault-sbtc-v2\?chain=mainnet$/);
  });

  test("renders CTA section with Connect wallet button", async ({ page }) => {
    await expect(page.getByText("Put your sBTC plan", { exact: false })).toBeVisible();
    // There are 2 Connect Wallet buttons (navbar + CTA), check the CTA one
    const ctaSection = page.locator("section").filter({ hasText: "Put your sBTC plan" });
    await expect(ctaSection.getByRole("button", { name: /Connect wallet/i })).toBeVisible();
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
