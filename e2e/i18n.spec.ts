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

  test("Chinese route renders with lang=zh", async ({ page }) => {
    await page.goto("/zh/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  });

  test("Chinese nav shows translated label", async ({ page }) => {
    await page.goto("/zh/dashboard");
    await expect(
      page.getByRole("link", { name: "首页" }).first()
    ).toBeVisible();
  });

  test("Japanese route renders with lang=ja", async ({ page }) => {
    await page.goto("/ja/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });

  test("Japanese nav shows translated label", async ({ page }) => {
    await page.goto("/ja/dashboard");
    await expect(
      page.getByRole("link", { name: "ホーム" }).first()
    ).toBeVisible();
  });

  test("Korean route renders with lang=ko", async ({ page }) => {
    await page.goto("/ko/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  });

  test("Korean nav shows translated label", async ({ page }) => {
    await page.goto("/ko/dashboard");
    await expect(
      page.getByRole("link", { name: "홈" }).first()
    ).toBeVisible();
  });

  test("Spanish route renders with lang=es", async ({ page }) => {
    await page.goto("/es/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("Spanish nav shows translated label", async ({ page }) => {
    await page.goto("/es/dashboard");
    await expect(
      page.getByRole("link", { name: "Inicio" }).first()
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

// Last-mile guard: every route's topbar title must come from the translation
// system, not a hardcoded English literal. This is the class of bug that let
// `<Topbar title="Home" />` / `title="Trade"` ship English titles on every
// non-en locale. If a non-brand route's localized topbar equals the English
// one, the title leaked outside next-intl. `/ai` is excluded — its title is
// the brand "Stacks AI", identical in every locale by design.
const LOCALIZED_ROUTES = [
  "/dashboard",
  "/trade",
  "/dca",
  "/assets",
  "/notifications",
  "/apps",
  "/bubbles",
];

async function topbarTitle(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  return ((await page.locator("header h1").first().textContent()) ?? "").trim();
}

test.describe("topbar titles are localized (not hardcoded English)", () => {
  for (const route of LOCALIZED_ROUTES) {
    test(`${route} topbar differs from English in vi/zh/ja/ko/es`, async ({ page }) => {
      const en = await topbarTitle(page, route);
      expect(en.length, `English topbar for ${route} should not be empty`).toBeGreaterThan(0);

      for (const locale of ["vi", "zh", "ja", "ko", "es"]) {
        const localized = await topbarTitle(page, `/${locale}${route}`);
        expect(
          localized.length,
          `Topbar for /${locale}${route} should not be empty`
        ).toBeGreaterThan(0);
        expect(
          localized,
          `Topbar on /${locale}${route} ("${localized}") must be localized, not the English "${en}" — looks like a hardcoded title leaked outside next-intl.`
        ).not.toBe(en);
      }
    });
  }
});
