import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Dashboard Page (Connected)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/dashboard");
  });

  test("renders page with Dashboard title in topbar", async ({ page }) => {
    // Use h1 to avoid matching hidden sidebar "Dashboard" label on mobile
    await expect(page.locator("h1").filter({ hasText: "Dashboard" })).toBeVisible();
  });

  test("renders wallet banner", async ({ page }) => {
    // Connected state shows the account-menu button (aria-labeled "Open
    // account menu"). Works on all viewports — the address text inside is
    // hidden on mobile but the button itself is always rendered.
    await expect(
      page.getByRole("button", { name: "Open account menu" })
    ).toBeVisible();
  });

  test("renders balance card section", async ({ page }) => {
    await expect(page.getByText(/Portfolio|Balance|Total/i).first()).toBeVisible();
  });

  test("renders quick actions when connected", async ({ page }) => {
    // Scope to main to avoid sidebar nav items (Swap, DCA Vault) hidden on mobile
    const quickActions = page.locator("main").getByText(/Send|Receive|Swap|DCA/i).first();
    await expect(quickActions).toBeVisible();
  });

  test("renders market stats section", async ({ page }) => {
    // Scope to main and target a labeled stat (the topbar STX pill is hidden
    // on small viewports and was masking this assertion on mobile).
    await expect(
      page.locator("main").getByText(/STX Price|Market Cap|Volume/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("renders trending tokens section", async ({ page }) => {
    await expect(page.getByText(/Trending/i).first()).toBeVisible();
  });

  test("renders crypto news section", async ({ page }) => {
    await expect(page.getByText(/News/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("renders recent activity section", async ({ page }) => {
    await expect(page.getByText(/Recent|Activity/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("page is scrollable", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    // Main content area is the overflow-y-auto div inside the layout
    const scrollArea = page.locator(".overflow-y-auto").first();
    await expect(scrollArea).toBeVisible();
    const scrollHeight = await scrollArea.evaluate((el) => el.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(0);
  });
});

// The draggable grid + its edit/refresh affordances only render above the
// mobile breakpoint (< 640px falls back to a plain stack with no WidgetShell).
test.describe("Dashboard grid controls (desktop)", () => {
  test.beforeEach(async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 700, "grid controls are desktop-only");
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/dashboard");
  });

  test("Customize toggles edit mode and exposes reset + drag handles", async ({ page }) => {
    const customize = page.getByRole("button", { name: "Customize" });
    await expect(customize).toBeVisible();

    await customize.click();

    // Edit mode: Done + Reset layout appear, and widgets gain drag handles.
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset layout" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Reorder / }).first()
    ).toBeVisible();

    // Toggling back returns to view mode.
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Customize" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
  });

  test("widget refresh button revalidates without crashing the card", async ({ page }) => {
    const trending = page.locator(".react-grid-item").filter({ hasText: "Trending" }).first();
    await expect(trending).toBeVisible();
    await trending.hover();

    const refresh = trending.getByRole("button", { name: /^Refresh / });
    await expect(refresh).toBeVisible();
    await refresh.click();

    // The card survives the revalidation round-trip.
    await expect(trending.getByText(/Trending/i).first()).toBeVisible();
  });

  test("refresh wiring spans multiple widgets", async ({ page }) => {
    // Both market- and portfolio-backed widgets get a refresh control, so more
    // than one is present; action-only widgets omit theirs (so it's not all).
    await page.waitForLoadState("networkidle");
    const refreshButtons = page.getByRole("button", { name: /^Refresh / });
    expect(await refreshButtons.count()).toBeGreaterThan(1);
  });

  test("Widgets menu hides and restores a widget", async ({ page }) => {
    await page.getByRole("button", { name: "Customize" }).click();
    await page.getByRole("button", { name: "Widgets" }).click();

    const newsCard = page.locator(".react-grid-item").filter({ hasText: "Crypto News" });
    await expect(newsCard).toHaveCount(1);

    // Hiding removes it from the grid.
    await page.getByRole("menuitemcheckbox", { name: /Crypto news/ }).click();
    await expect(newsCard).toHaveCount(0);

    // Show all brings every hidden widget back.
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(newsCard).toHaveCount(1);
  });
});
