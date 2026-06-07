import { test, expect } from "@playwright/test";

test.describe("i18n", () => {
  test("English keeps unprefixed URL and lang=en", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Vietnamese route renders with lang=vi", async ({ page }) => {
    await page.goto("/vi/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });

  test("Vietnamese nav shows translated label", async ({ page }) => {
    await page.goto("/vi/dashboard");
    await expect(
      page.getByRole("link", { name: "Trang chủ" }).first()
    ).toBeVisible();
  });

  test("English nav shows English label", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: "Home" }).first()
    ).toBeVisible();
  });

  test("language switcher moves between locales and keeps the page", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const switcher = page.getByRole("group", { name: /language|ngôn ngữ/i });
    await switcher.getByRole("button", { name: "vi" }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });
});
