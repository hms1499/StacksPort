import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * CORS allow-list for the API proxy routes.
 *
 * Only the StacksPort Chrome extension legitimately calls these endpoints
 * cross-origin (from its background service worker / popup, which run under a
 * `chrome-extension://<id>` origin). Same-origin calls from the web app itself
 * carry no `Origin` header and need no ACAO.
 *
 * We deliberately do NOT echo `*` — that previously let any website read the
 * portfolio/market/bitflow proxies and abuse the server-side API keys.
 *
 * Unpacked/dev extensions get a random id, so we allow any `chrome-extension:`
 * origin rather than pinning one id. Once published with a stable id you can
 * tighten this to an exact-origin check.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).protocol === "chrome-extension:";
  } catch {
    return false;
  }
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

function handleApiCors(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin);

  // Preflight — answer centrally so individual routes don't each reinvent CORS.
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: allowed && origin ? corsHeaders(origin) : undefined,
    });
  }

  const res = NextResponse.next();
  if (allowed && origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

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
