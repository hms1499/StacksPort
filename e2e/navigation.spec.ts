import { test, expect } from "@playwright/test";
import {
  mockWalletConnected,
  mockWalletDisconnected,
  mockAPIs,
} from "./fixtures/test-utils";

test.describe("Navigation - Desktop Sidebar", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Sidebar is hidden on mobile (md:hidden), skip these tests on mobile profiles
    if (testInfo.project.name.includes("mobile")) {
      testInfo.skip();
    }
    await mockWalletConnected(page);
    await mockAPIs(page);
  });

  test("sidebar renders with all nav links", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for the sidebar wrapper to appear (hidden md:block wrapper)
    await page.waitForLoadState("networkidle");
    // Sidebar nav links should be visible on desktop viewport (1280px from project config)
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/assets"]').first()).toBeVisible();
    await expect(page.locator('a[href="/trade"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dca"]').first()).toBeVisible();
    await expect(page.locator('a[href="/notifications"]').first()).toBeVisible();
    await expect(page.locator('a[href="/ai"]').first()).toBeVisible();
  });

  test("renders StacksPort logo text", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("StacksPort").first()).toBeVisible({ timeout: 10000 });
  });

  test("clicking nav link navigates to correct page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Wait for link to be stable before clicking
    const tradeLink = page.locator('a[href="/trade"]').first();
    await expect(tradeLink).toBeVisible({ timeout: 10000 });
    await tradeLink.click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test("active link has indicator on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const dashboardLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashboardLink).toBeVisible({ timeout: 10000 });
    // Active link contains the active indicator span (layoutId="sidebar-active")
    // Check via class or by the active styling
    await expect(dashboardLink).toHaveClass(/text-\[var\(--accent\)\]/);
  });

  test("sidebar is hidden on landing page", async ({ page }) => {
    await mockWalletDisconnected(page);
    await page.goto("/");
    // On landing page, sidebar wrapper has "hidden md:block" but layout-client checks isHomePage
    // and doesn't render the sidebar at all
    const sidebarLinks = page.locator('a[href="/assets"]');
    await expect(sidebarLinks).toBeHidden();
  });
});

test.describe("Navigation - Mobile Bottom Nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
  });

  test("bottom nav renders on mobile", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Bottom nav uses md:hidden, visible on mobile
    const bottomNav = page.locator("nav.fixed");
    await expect(bottomNav).toBeVisible({ timeout: 10000 });
  });

  test("bottom nav has all navigation links", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const bottomNav = page.locator("nav.fixed").last();
    await expect(bottomNav.locator('a[href="/dashboard"]')).toBeVisible({ timeout: 10000 });
    await expect(bottomNav.locator('a[href="/assets"]')).toBeVisible();
    await expect(bottomNav.locator('a[href="/trade"]')).toBeVisible();
    await expect(bottomNav.locator('a[href="/dca"]')).toBeVisible();
    await expect(bottomNav.locator('a[href="/notifications"]')).toBeVisible();
    await expect(bottomNav.locator('a[href="/ai"]')).toBeVisible();
  });

  test("bottom nav navigation works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.locator('nav.fixed a[href="/trade"]').last().click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test("bottom nav is hidden on landing page", async ({ page }) => {
    await mockWalletDisconnected(page);
    await page.goto("/");
    // Bottom nav only renders on non-home pages
    await expect(page.locator('nav.fixed a[href="/dashboard"]')).toBeHidden();
  });
});

test.describe("Navigation - Route Guards", () => {
  test("connected user on landing page redirects to dashboard", async ({
    page,
  }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
