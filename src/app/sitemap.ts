import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Routes with standalone value for a signed-out visitor. `/assets` is omitted
// on purpose: it only renders meaningful content (holdings, PnL, stacking) once
// a wallet is connected, so a guest crawl sees a thin connect-prompt — not worth
// advertising for indexing. It still ships unique metadata for direct shares.
const PUBLIC_ROUTES = [
  "",
  "/dashboard",
  "/trade",
  "/dca",
  "/bubbles",
  "/apps",
] as const;

// as-needed prefix: the default locale stays unprefixed (/dashboard),
// other locales get a prefix (/vi/dashboard).
function localizedPath(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routing.locales.flatMap((locale) =>
    PUBLIC_ROUTES.map((path, index) => ({
      url: `${SITE_URL}${localizedPath(locale, path)}`,
      lastModified: now,
      changeFrequency: (index === 0 ? "weekly" : "daily") as "weekly" | "daily",
      priority: index === 0 ? 1 : 0.8,
    })),
  );
}
