import { test, expect } from "@playwright/test";
import { mockWalletDisconnected } from "./fixtures/test-utils";

test.describe("Landing Page (Guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletDisconnected(page);
    await page.route("**/api/metrics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plansCreated: 12,
          volumeUsd: 42000,
          swapsExecuted: 38,
          avgSwapsPerPlan: 3.2,
          sources: { stxVault: "ok", sbtcVault: "ok", prices: "ok" },
          updatedAt: Date.now(),
        }),
      })
    );
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

  test("renders authoritative live protocol metrics", async ({ page }) => {
    await expect(page.getByText("DCA Plans Created")).toBeVisible();
    await expect(page.getByText("Volume Executed")).toBeVisible();
    await expect(page.getByText("Swaps Executed")).toBeVisible();
    await expect(
      page.getByText("On-chain totals from both DCA vaults", { exact: false })
    ).toBeVisible();
  });

  test("does not turn an unavailable metrics response into zeroes", async ({ page }) => {
    await page.unroute("**/api/metrics");
    await page.route("**/api/metrics", (route) =>
      route.fulfill({ status: 503, body: "unavailable" })
    );
    await page.reload();

    await expect(
      page.getByText("Live on-chain metrics are temporarily unavailable.")
    ).toBeVisible();
    await expect(page.getByText("DCA Plans Created")).toHaveCount(0);
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

  test("updates navbar state from the app scroll container", async ({ page }) => {
    const navbar = page.locator("nav").first();
    await expect(navbar).toHaveAttribute("data-scrolled", "false");

    await page.locator("main").evaluate((element) => {
      element.scrollTop = 200;
      element.dispatchEvent(new Event("scroll"));
    });

    await expect(navbar).toHaveAttribute("data-scrolled", "true");
  });

  test("closes the mobile navigation menu with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    await trigger.click();
    await expect(
      page.getByRole("button", { name: "Close navigation menu" })
    ).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation menu" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps landing content visible with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();

    const headline = page.locator("h1");
    await expect(headline).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Build an STX to sBTC schedule" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Built for transparent automation" })
    ).toBeVisible();

    await expect(headline).toHaveCSS("opacity", "1");
  });

  test("renders footer", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="#"]')).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Twitter" })).toHaveCount(0);
  });
});
