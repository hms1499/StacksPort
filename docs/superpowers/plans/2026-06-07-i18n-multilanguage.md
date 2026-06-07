# Multi-language (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English + Vietnamese internationalization to StacksPort using next-intl with routed `[locale]` segments (`localePrefix: 'as-needed'`), translating static UI text only.

**Architecture:** Page routes move under `src/app/[locale]/`; API routes stay at `src/app/api/`. A single composed middleware runs CORS for `/api/*` and next-intl locale resolution for pages. Messages live in `messages/{locale}.json`, namespaced by feature. English keeps existing unprefixed URLs (`/dashboard`); Vietnamese is prefixed (`/vi/dashboard`).

**Tech Stack:** Next.js 15 App Router, React 19, next-intl 4.x, TypeScript, vitest, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-06-07-i18n-multilanguage-design.md`

---

## File Structure

**New files:**
- `src/i18n/routing.ts` — locale list, default, prefix strategy
- `src/i18n/navigation.ts` — locale-aware `Link`/`useRouter`/`usePathname`/`redirect`/`getPathname`
- `src/i18n/request.ts` — per-request locale + message loader
- `messages/en.json` — English catalog (source of truth)
- `messages/vi.json` — Vietnamese catalog
- `src/components/ui/LanguageSwitcher.tsx` — locale toggle
- `src/app/[locale]/layout.tsx` — root layout (html/body), provider, metadata
- `src/app/[locale]/not-found.tsx` — localized 404
- `src/i18n/messages.test.ts` — catalog completeness unit test
- `e2e/i18n.spec.ts` — locale e2e

**Modified files:**
- `next.config.ts` — wrap with next-intl plugin
- `src/middleware.ts` — compose CORS + next-intl
- `src/app/sitemap.ts` — per-locale entries
- All page route folders move into `src/app/[locale]/`
- ~26 components: swap `next/link`/`next/navigation` → `@/i18n/navigation`, then `useTranslations`

**Removed:**
- `src/app/layout.tsx` (its html/body responsibility moves to `[locale]/layout.tsx`)
- `src/app/page 2.tsx` (stray untracked duplicate)

---

## Task 1: Install next-intl and configure the plugin

**Files:**
- Modify: `package.json` (via npm)
- Modify: `next.config.ts`

- [ ] **Step 1: Install next-intl**

Run: `npm install next-intl@^4.13.0`
Expected: added to dependencies, no errors.

- [ ] **Step 2: Read current next.config.ts**

Run: `cat next.config.ts`
Note the existing config object so it is preserved inside the wrapper.

- [ ] **Step 3: Wrap config with the next-intl plugin**

Edit `next.config.ts` — keep the existing `nextConfig` object exactly as-is, and change only the export:

```ts
import createNextIntlPlugin from "next-intl/plugin";

// ...existing nextConfig object unchanged...

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
```

(Replace the previous `export default nextConfig;`.)

- [ ] **Step 4: Verify it still parses (request.ts does not exist yet, so don't build)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no error about `next.config.ts` syntax (errors about missing `request.ts` import path are fine — created in Task 2).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "build(i18n): install next-intl and wire plugin"
```

---

## Task 2: i18n config files + seed message catalogs

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/navigation.ts`
- Create: `src/i18n/request.ts`
- Create: `messages/en.json`
- Create: `messages/vi.json`

- [ ] **Step 1: Create `src/i18n/routing.ts`**

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  // English keeps unprefixed URLs (/dashboard); other locales prefixed (/vi/dashboard)
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 2: Create `src/i18n/navigation.ts`**

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation APIs.
// Use these everywhere instead of next/link and next/navigation so the
// active locale is preserved across client navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 3: Create `src/i18n/request.ts`**

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create `messages/en.json` with seed namespaces**

```json
{
  "nav": {
    "home": "Home",
    "bubbles": "Bubbles",
    "assets": "My Assets",
    "assetsShort": "Assets",
    "swap": "Swap",
    "dcaVault": "DCA Vault",
    "dcaShort": "DCA",
    "alerts": "Alerts",
    "stacksAi": "Stacks AI",
    "aiShort": "AI",
    "connectedApps": "Connected Apps",
    "appsShort": "Apps",
    "more": "More",
    "collapse": "Collapse"
  },
  "common": {
    "language": "Language",
    "english": "English",
    "vietnamese": "Tiếng Việt"
  }
}
```

- [ ] **Step 5: Create `messages/vi.json` mirroring the same keys**

```json
{
  "nav": {
    "home": "Trang chủ",
    "bubbles": "Bong bóng",
    "assets": "Tài sản của tôi",
    "assetsShort": "Tài sản",
    "swap": "Hoán đổi",
    "dcaVault": "Kho DCA",
    "dcaShort": "DCA",
    "alerts": "Cảnh báo",
    "stacksAi": "Stacks AI",
    "aiShort": "AI",
    "connectedApps": "Ứng dụng kết nối",
    "appsShort": "Ứng dụng",
    "more": "Thêm",
    "collapse": "Thu gọn"
  },
  "common": {
    "language": "Ngôn ngữ",
    "english": "English",
    "vietnamese": "Tiếng Việt"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n messages
git commit -m "feat(i18n): add routing, navigation, request config and seed catalogs"
```

---

## Task 3: Restructure routes under `[locale]` and create the locale layout

This is the structural core. After it, the app must run with English at `/dashboard` and Vietnamese at `/vi/dashboard`.

**Files:**
- Move: every page route folder + `page.tsx` into `src/app/[locale]/`
- Create: `src/app/[locale]/layout.tsx`
- Create: `src/app/[locale]/not-found.tsx`
- Remove: `src/app/layout.tsx`
- Keep at `src/app/` root: `api/`, `icon.tsx`, `icon-192/`, `icon-512/`, `manifest.ts`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `global-error.tsx`

- [ ] **Step 1: Create the `[locale]` directory and move page routes**

Run:
```bash
mkdir -p "src/app/[locale]"
git mv src/app/page.tsx        "src/app/[locale]/page.tsx"
git mv src/app/dashboard       "src/app/[locale]/dashboard"
git mv src/app/trade           "src/app/[locale]/trade"
git mv src/app/dca             "src/app/[locale]/dca"
git mv src/app/ai              "src/app/[locale]/ai"
git mv src/app/assets          "src/app/[locale]/assets"
git mv src/app/apps            "src/app/[locale]/apps"
git mv src/app/bubbles         "src/app/[locale]/bubbles"
git mv src/app/notifications   "src/app/[locale]/notifications"
git mv src/app/error.tsx       "src/app/[locale]/error.tsx"
```

Expected: folders relocated. `api/`, metadata files, `global-error.tsx`, `not-found.tsx` (root) stay put for now.

- [ ] **Step 2: Create `src/app/[locale]/layout.tsx`** (absorbs the old root layout's html/body + fonts, adds locale)

```tsx
import type { Metadata, Viewport } from "next";
import { Syne, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import LayoutClient from "../layout-client";
import { routing } from "@/i18n/routing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Stacks",
    "sBTC",
    "STX",
    "DCA",
    "Bitcoin DeFi",
    "non-custodial",
    "portfolio tracker",
  ],
  manifest: "/manifest.webmanifest",
  other: {
    "talentapp:project_verification":
      "8e7d88c649059a8b9ca547b2c4611ac999a2d7e09ca60083f58af1e1aaa10cb6937fcce415886641448b653b69b94b767b5e4fff6dfb9c6e2403420da36c4cc1",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${syne.variable} ${jetBrainsMono.variable} ${syne.className} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider>
          <LayoutClient>{children}</LayoutClient>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Remove the old root layout**

Run: `git rm src/app/layout.tsx`
Expected: removed. (`[locale]/layout.tsx` is now the topmost layout and serves as the root.)

- [ ] **Step 4: Create `src/app/[locale]/not-found.tsx`**

Move the existing not-found content into the locale segment so it renders inside the provider. First inspect the current one:

Run: `cat src/app/not-found.tsx`

Then create `src/app/[locale]/not-found.tsx` with the same JSX, importing `Link` from `@/i18n/navigation` instead of `next/link`. Keep `src/app/not-found.tsx` as a minimal global fallback for non-locale paths (plain `<html><body>` with a link to `/`), since Next requires a root-level not-found when the catch-all is under `[locale]`.

Minimal `src/app/not-found.tsx`:

```tsx
import { redirect } from "next/navigation";

// Unmatched top-level paths fall through to the default locale's 404.
export default function RootNotFound() {
  redirect("/");
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds. If it complains about missing root layout, confirm `[locale]/layout.tsx` exists and exports default. Fix any import-path errors (relative `../globals.css`, `../layout-client`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(i18n): move page routes under [locale] and add locale layout"
```

---

## Task 4: Compose CORS + next-intl middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Rewrite `src/middleware.ts` to branch by path**

Preserve the existing CORS helpers verbatim; add next-intl for page routes.

```ts
import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

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

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api")) {
    return handleApiCors(req);
  }
  return intlMiddleware(req);
}

export const config = {
  // Run on API routes (CORS) and all page routes (locale), skipping Next.js
  // internals and any path with a dot (static files like /sw.js, /manifest.webmanifest).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: success.

- [ ] **Step 3: Manual smoke test in dev**

Run: `npm run dev` (background), then in another shell:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/vi/dashboard
curl -s -H "Origin: chrome-extension://abc" -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/market/snapshot
```
Expected: `/dashboard` → 200, `/vi/dashboard` → 200, `/api/...` → 200 with CORS header. Then kill the dev server (free port 3000).

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(i18n): compose CORS and next-intl middleware"
```

---

## Task 5: Checkpoint — full build + existing e2e still green

**Files:** none (verification only)

- [ ] **Step 1: Build**

Run: `npm run build 2>&1 | tail -20`
Expected: success.

- [ ] **Step 2: Run existing e2e (desktop) to catch route regressions**

Run: `npx playwright test --project=chromium 2>&1 | tail -30`
Expected: baseline ~84 passing. Some specs may fail if they assert paths that now behave differently — note them; they get fixed in Task 11. Do NOT change app code to satisfy a test that should be updated.

- [ ] **Step 3: No commit** (verification checkpoint). Record any failing specs in the task notes.

---

## Task 6: LanguageSwitcher component

**Files:**
- Create: `src/components/ui/LanguageSwitcher.tsx`

- [ ] **Step 1: Create the component**

Switches locale while keeping the user on the same path. Uses the locale-aware navigation wrappers and the next-intl `useLocale`.

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // pathname from @/i18n/navigation is locale-agnostic; router applies the new locale
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn("flex items-center gap-1", isPending && "opacity-60")}
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-pressed={loc === locale}
          className={cn(
            "px-2 py-1 rounded-md text-xs font-semibold uppercase transition-colors",
            loc === locale
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
          )}
          title={loc === "en" ? t("english") : t("vietnamese")}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit 2>&1 | grep -i languageswitcher || echo "no LanguageSwitcher errors"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/LanguageSwitcher.tsx
git commit -m "feat(i18n): add LanguageSwitcher component"
```

---

## Task 7: Navigation sweep — adopt locale-aware Link/router

Replace `next/link` and `next/navigation` imports with `@/i18n/navigation` across **app components** so locale is preserved on navigation. Do NOT touch API routes or server-only files.

**Files (from grep — `next/link`):** `src/components/landing/Navbar.tsx`, `Hero.tsx`, `CTASection.tsx`, `src/components/layout/BottomNav.tsx`, `STXChip.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `src/components/dashboard/{DCASummaryCard,RecentActivity,BalanceCard,DCAPerformanceCard,DashboardFooter,QuickActions,PortfolioBreakdown,WelcomeSteps,PoxCycleCard,AlertsPanel}.tsx`, `src/components/dca/performance/{DCAInPanel,DCAOutPanel,DCAPerformanceContent}.tsx`, `src/components/bubbles/BubbleTooltip.tsx`, `src/components/dca/DCAHeroStats.tsx`, `src/components/assets/YieldOpportunities.tsx`, `src/components/notifications/NotificationDrawer.tsx`

**Files (`next/navigation` — `useRouter`/`usePathname`/`redirect` only; keep `useSearchParams`/`useParams` from next/navigation):** `src/components/landing/HomePageClient.tsx`, `src/components/trade/SwapWidget.tsx`, `src/components/layout/{CommandPalette,Sidebar,BottomNav}.tsx`, `src/components/bubbles/BubblesPageContent.tsx`, `src/components/assets/drawer/{QuickSwap,index,YieldInfo}.tsx`, `src/components/notifications/NotificationsPageWrapper.tsx`

- [ ] **Step 1: Swap `next/link` imports**

For each file in the `next/link` list, change `import Link from "next/link";` → `import { Link } from "@/i18n/navigation";`. The `Link` API is compatible (`href`, `className`, children).

Find remaining offenders: `grep -rln "from ['\"]next/link['\"]" src/components src/app/\[locale\]`
Expected after edits: empty (except none).

- [ ] **Step 2: Swap navigation hooks**

For each file in the `next/navigation` list, split the import: move `useRouter`, `usePathname`, `redirect` to `@/i18n/navigation`; leave `useSearchParams`, `useParams`, `notFound` imported from `next/navigation`.

Example (CommandPalette.tsx):
```ts
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
```

`src/app/layout-client.tsx` uses `usePathname` — switch it to `@/i18n/navigation` too so `isHomePage` compares the locale-stripped path (`/` works for both `/` and `/vi`).

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit 2>&1 | tail -20 && npm run build 2>&1 | tail -15`
Expected: no type errors, build succeeds.

- [ ] **Step 4: Verify no stale imports remain**

Run:
```bash
grep -rln "from ['\"]next/link['\"]" src/components "src/app/[locale]"
grep -rEn "useRouter|usePathname" src/components "src/app/[locale]" | grep "next/navigation"
```
Expected: first empty; second shows only `useSearchParams`/`useParams` lines (none for router/pathname).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(i18n): use locale-aware navigation wrappers app-wide"
```

---

## Task 8: Convert the `nav` namespace (worked template for all later conversions)

This task is the template. Every later namespace task follows the same 4-move pattern:
(a) read file → (b) add keys to `en.json` + `vi.json` → (c) replace literals with `t("key")` via `useTranslations("namespace")` → (d) build.

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `messages/en.json`, `messages/vi.json` (keys already seeded in Task 2)

- [ ] **Step 1: Convert Sidebar.tsx**

Add `import { useTranslations } from "next-intl";` and inside the component `const t = useTranslations("nav");`. Change `navItems` to use translation keys instead of literal labels:

```tsx
const navItems = [
  { href: "/dashboard",     key: "home",          icon: LayoutDashboard },
  { href: "/bubbles",       key: "bubbles",       icon: Circle },
  { href: "/assets",        key: "assets",        icon: Wallet },
  { href: "/trade",         key: "swap",          icon: ArrowLeftRight },
  { href: "/dca",           key: "dcaVault",      icon: Repeat2 },
  { href: "/notifications", key: "alerts",        icon: Bell },
  { href: "/ai",            key: "stacksAi",      icon: Sparkles },
  { href: "/apps",          key: "connectedApps", icon: Globe },
] as const;
```

In the render, replace `{label}` usages with `{t(key)}` and `title={collapsed ? label : undefined}` with `title={collapsed ? t(key) : undefined}`. Replace the Collapse button label `<span>Collapse</span>` with `<span>{t("collapse")}</span>`.

- [ ] **Step 2: Convert BottomNav.tsx**

Add `const t = useTranslations("nav");`. Change both arrays to keys:

```tsx
const primaryNavItems = [
  { href: "/dashboard", key: "home",       icon: LayoutDashboard },
  { href: "/assets",    key: "assetsShort", icon: Wallet },
  { href: "/trade",     key: "swap",       icon: ArrowLeftRight },
  { href: "/dca",       key: "dcaShort",   icon: Repeat2 },
] as const;

const moreNavItems = [
  { href: "/bubbles",       key: "bubbles",   icon: Circle },
  { href: "/notifications", key: "alerts",    icon: Bell },
  { href: "/ai",            key: "aiShort",   icon: Sparkles },
  { href: "/apps",          key: "appsShort", icon: Globe },
] as const;
```

Replace `{label}` → `{t(key)}` in the render, and any literal "More" label → `{t("more")}`.

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -15`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx messages
git commit -m "feat(i18n): translate navigation (nav namespace)"
```

---

## Tasks 9–14: Convert remaining namespaces

Each task below follows the exact pattern from Task 8. For each: open the listed files, extract every user-visible English string literal (JSX text, `placeholder`, `title`, `aria-label`, `alt`, toast/error messages) into the named namespace in **both** `messages/en.json` (verbatim English) and `messages/vi.json` (translated), then replace each literal with `t("key")` using `useTranslations("<namespace>")` in client components or `getTranslations("<namespace>")` in async server components. Do not extract dynamic values (numbers, addresses, token symbols, API content). Build + commit after each task.

> Rule for keys: nest by component when a namespace is large, e.g. `"dca": { "hero": { "title": "..." } }`. Keep en.json and vi.json key-identical (Task 15 enforces this with a test).

- [ ] **Task 9 — `common` namespace** (shared chrome): `src/components/layout/{Topbar,STXChip,CommandPalette}.tsx`, `src/components/wallet/*` (connect/disconnect labels), `src/components/ui/*` reusable buttons. Strings: Connect Wallet, Disconnect, Copy, Loading, Retry, Save, Cancel, Search, Close. Build + commit `feat(i18n): translate shared UI (common namespace)`.

- [ ] **Task 10 — `dashboard` namespace**: `src/components/dashboard/*.tsx` (BalanceCard, QuickActions, RecentActivity, PortfolioBreakdown, DCASummaryCard, DCAPerformanceCard, PoxCycleCard, AlertsPanel, WelcomeSteps, DashboardFooter) and `src/app/[locale]/dashboard/page.tsx`. Build + commit `feat(i18n): translate dashboard (dashboard namespace)`.

- [ ] **Task 11 — `trade` namespace**: `src/components/trade/*.tsx` (SwapWidget, migration UI) and `src/app/[locale]/trade/page.tsx`. Build + commit `feat(i18n): translate trade (trade namespace)`.

- [ ] **Task 12 — `dca` namespace** (largest): `src/components/dca/**/*.tsx`, `src/components/dca-out/**/*.tsx`, `src/app/[locale]/dca/**/page.tsx`. Build + commit `feat(i18n): translate DCA (dca namespace)`.

- [ ] **Task 13 — `assets` namespace**: `src/components/assets/**/*.tsx` (holdings, PnL, stacking, drawer, YieldOpportunities) and `src/app/[locale]/assets/page.tsx`. Build + commit `feat(i18n): translate assets (assets namespace)`.

- [ ] **Task 14 — `notifications`, `ai`, `bubbles`, `apps`, `landing` namespaces**: `src/components/notifications/*.tsx`, `src/components/ai/*.tsx` (labels/buttons only — AI output stays dynamic), `src/components/bubbles/*.tsx`, `src/components/apps/*.tsx`, `src/components/landing/*.tsx`, and their pages under `src/app/[locale]/`. Build + commit `feat(i18n): translate notifications, ai, bubbles, apps, landing`.

---

## Task 15: Catalog completeness unit test

**Files:**
- Create: `src/i18n/messages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import vi from "../../messages/vi.json";

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Json, path)
      : [path];
  });
}

describe("message catalogs", () => {
  it("vi has every key that en has", () => {
    const enKeys = new Set(flatten(en as Json));
    const viKeys = new Set(flatten(vi as Json));
    const missing = [...enKeys].filter((k) => !viKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("vi has no extra keys beyond en", () => {
    const enKeys = new Set(flatten(en as Json));
    const viKeys = new Set(flatten(vi as Json));
    const extra = [...viKeys].filter((k) => !enKeys.has(k));
    expect(extra).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/i18n/messages.test.ts 2>&1 | tail -20`
Expected: PASS if catalogs were kept in sync; if it lists missing/extra keys, fix the catalogs (do not weaken the test).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.test.ts
git commit -m "test(i18n): assert en/vi catalogs are key-identical"
```

---

## Task 16: Localized metadata + hreflang

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Add `meta` namespace keys to `messages/{en,vi}.json`

- [ ] **Step 1: Add `meta` keys**

In both catalogs add:
```json
"meta": {
  "defaultTitle": "StacksPort - Non-Custodial sBTC DCA on Stacks",
  "description": "Automate recurring STX to sBTC dollar-cost-averaging on Stacks. Non-custodial, on-chain, Bitcoin-secured."
}
```
(Translate the `vi` values.)

- [ ] **Step 2: Replace static `metadata` export with `generateMetadata`**

In `src/app/[locale]/layout.tsx`, remove the `export const metadata` object and add:

```tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("defaultTitle"),
      template: `%s | ${SITE_NAME}`,
    },
    description: t("description"),
    applicationName: SITE_NAME,
    manifest: "/manifest.webmanifest",
    alternates: {
      languages: {
        en: "/",
        vi: "/vi",
      },
    },
    other: {
      "talentapp:project_verification":
        "8e7d88c649059a8b9ca547b2c4611ac999a2d7e09ca60083f58af1e1aaa10cb6937fcce415886641448b653b69b94b767b5e4fff6dfb9c6e2403420da36c4cc1",
    },
  };
}
```

Keep `viewport` and `generateStaticParams` as-is.

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -15`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/layout.tsx" messages
git commit -m "feat(i18n): localized metadata and hreflang alternates"
```

---

## Task 17: Per-locale sitemap

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Emit English (unprefixed) + Vietnamese (`/vi`) entries**

```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

const PUBLIC_ROUTES = ["", "/dashboard", "/trade", "/dca", "/bubbles", "/apps"] as const;

function localizedPath(locale: string, path: string) {
  // as-needed: default locale is unprefixed
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routing.locales.flatMap((locale) =>
    PUBLIC_ROUTES.map((path, index) => ({
      url: `${SITE_URL}${localizedPath(locale, path)}`,
      lastModified: now,
      changeFrequency: index === 0 ? ("weekly" as const) : ("daily" as const),
      priority: index === 0 ? 1 : 0.8,
    })),
  );
}
```

- [ ] **Step 2: Build + sanity check**

Run: `npm run build 2>&1 | tail -10`
Expected: success. Optionally curl `/sitemap.xml` in dev to confirm `/vi/...` entries appear, then free port 3000.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(i18n): emit per-locale sitemap entries"
```

---

## Task 18: E2E coverage for i18n

**Files:**
- Create: `e2e/i18n.spec.ts`
- Modify: any existing spec that broke in Task 5

- [ ] **Step 1: Write the e2e spec**

```ts
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

  test("language switcher keeps the user on the same page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("group", { name: /language|ngôn ngữ/i }).getByRole("button", { name: "vi" }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });

  test("Vietnamese nav shows translated label", async ({ page }) => {
    await page.goto("/vi/dashboard");
    await expect(page.getByRole("link", { name: "Trang chủ" }).first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test e2e/i18n.spec.ts --project=chromium 2>&1 | tail -20`
Expected: PASS. If the switcher selector differs, align it with the rendered LanguageSwitcher (it must be mounted in Sidebar/Topbar — add it there in this step if not yet visible).

- [ ] **Step 3: Mount LanguageSwitcher in the UI (if not already)**

Add `<LanguageSwitcher />` to `src/components/layout/Sidebar.tsx` (near the Collapse toggle) and `src/components/layout/Topbar.tsx` for mobile. Build to confirm.

- [ ] **Step 4: Fix any specs flagged in Task 5**

Update path assertions in existing specs that legitimately changed. Do not loosen meaningful assertions.

- [ ] **Step 5: Full e2e run**

Run: `npm run test:e2e 2>&1 | tail -30`
Expected: desktop ~84 + new i18n tests passing; mobile ~78.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(i18n): e2e for locale routing and switcher"
```

---

## Task 19: Cleanup stray file

**Files:**
- Remove: `src/app/page 2.tsx`

- [ ] **Step 1: Confirm it is an accidental duplicate**

Run: `diff "src/app/page 2.tsx" "src/app/[locale]/page.tsx" 2>/dev/null; ls -la "src/app/page 2.tsx"`
Expected: it is a near-duplicate / stray editor copy with no unique purpose.

- [ ] **Step 2: Remove it**

Run: `rm "src/app/page 2.tsx"`

- [ ] **Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -8
git add -A
git commit -m "chore: remove stray page 2.tsx duplicate"
```

---

## Final Verification

- [ ] `npm run build` succeeds
- [ ] `npm run lint` clean
- [ ] `npx vitest run` green (incl. catalog completeness)
- [ ] `npm run test:e2e` green (desktop + mobile, incl. i18n spec)
- [ ] Manual: `/dashboard` (English), `/vi/dashboard` (Vietnamese), switcher round-trips, no console errors
- [ ] Free port 3000 after dev verification

---

## Self-Review Notes

- **Spec coverage:** library (T1), routing/navigation/request (T2), `[locale]` move + layout + lang attr (T3), middleware composition (T4), switcher (T6), navigation sweep (T7), UI translation by namespace (T8–T14), missing-key fallback handled by next-intl + completeness test (T15), localized metadata + hreflang (T16), per-locale sitemap (T17), e2e + unit tests (T15/T18), stray file cleanup (T19). All spec sections mapped.
- **Out-of-scope respected:** no translation of dynamic prices/news/AI output; API routes untouched.
- **Type consistency:** `routing`, `Locale`, navigation wrapper names (`Link`/`useRouter`/`usePathname`/`redirect`/`getPathname`) used identically across tasks; `useTranslations`/`getTranslations` namespaces match catalog roots.
