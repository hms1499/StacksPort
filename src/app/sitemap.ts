import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PUBLIC_ROUTES.map((path, index) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: index === 0 ? "weekly" : "daily",
    priority: index === 0 ? 1 : 0.8,
  }));
}
