import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { handleApiCors } from "./lib/cors";

const intlMiddleware = createMiddleware(routing);

// Extensionless metadata routes (file-based conventions). These must NOT be
// locale-rewritten — they serve fixed image/icon responses. The dotted variants
// (/sitemap.xml, /robots.txt, /manifest.webmanifest) are already excluded by the
// matcher's `.*\..*` rule below.
const METADATA_PATHS = new Set([
  "/icon",
  "/icon-192",
  "/icon-512",
  "/opengraph-image",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // API routes: keep the existing extension CORS handling, no locale rewriting.
  if (pathname.startsWith("/api")) {
    return handleApiCors(req);
  }
  // Metadata routes: serve as-is, no locale prefix.
  if (METADATA_PATHS.has(pathname)) {
    return NextResponse.next();
  }
  // Page routes: resolve locale (URL prefix → cookie → Accept-Language → default).
  return intlMiddleware(req);
}

export const config = {
  // Run on API routes (CORS) and all page routes (locale), skipping Next.js
  // internals and any path with a dot (static files like /sw.js, /manifest.webmanifest).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
