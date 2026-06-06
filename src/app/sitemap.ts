import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PUBLIC_ROUTES = [
  "",
  "/dashboard",
  "/trade",
  "/dca",
  "/assets",
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
