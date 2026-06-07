# Design: Multi-language (i18n) support for StacksPort

**Date:** 2026-06-07
**Status:** Approved — ready for implementation planning

## Summary

Add internationalization to StacksPort using **next-intl** with routed `[locale]`
segments. Launch with **English (default) + Vietnamese**, with the architecture
ready to add more locales by editing config + adding a message catalog. Only
**static UI text** is translated; dynamic content (prices, news, AI insights)
stays as-is. SEO benefits from per-locale metadata and `hreflang` tags.

## Decisions

| Topic | Decision |
|---|---|
| Library | `next-intl` (App Router native, server + client support) |
| Locales | `en` (default), `vi`; extensible |
| URL strategy | Routed `[locale]` segment, `localePrefix: 'as-needed'` |
| URL shape | English keeps existing paths (`/dashboard`); Vietnamese is prefixed (`/vi/dashboard`) |
| Translation scope | Static UI text + SEO metadata only. Dynamic content (CoinGecko prices, news APIs, Groq AI) NOT translated |
| API routes | `src/app/api/**` stay outside `[locale]` — never localized |

### Why `as-needed` over `always`

`as-needed` leaves existing English URLs untouched (`/dashboard`), so the recent
SEO investment (sitemap, metadata, canonical URLs) is not disrupted. Only
Vietnamese gets a prefix (`/vi/...`). `always` would redirect every existing
English URL to `/en/...`, forcing a sitemap/SEO rework for no functional gain.

## Architecture

### Data flow

```
request
  → middleware: resolve locale (URL prefix → cookie NEXT_LOCALE → Accept-Language → default 'en')
  → render src/app/[locale]/layout.tsx
  → NextIntlClientProvider supplies messages for the active locale
  → components read strings via useTranslations() (client) / getTranslations() (server)
```

### New files

| File | Responsibility |
|---|---|
| `src/i18n/routing.ts` | `defineRouting` — locales `['en','vi']`, `defaultLocale: 'en'`, `localePrefix: 'as-needed'` |
| `src/i18n/navigation.ts` | Locale-aware wrappers re-exported from `createNavigation(routing)`: `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` |
| `src/i18n/request.ts` | `getRequestConfig` — validate requested locale, load the matching message catalog |
| `messages/en.json` | Source-of-truth English catalog, namespaced by feature |
| `messages/vi.json` | Vietnamese catalog (same key shape as `en.json`) |
| `src/components/ui/LanguageSwitcher.tsx` | Toggle locale while preserving the current path/query; writes `NEXT_LOCALE` cookie |

### Message catalog structure

Namespaced by feature so each component pulls a small, focused slice:

```
common      — shared labels (Save, Cancel, Loading, errors)
nav         — sidebar + bottom-nav items
dashboard   — dashboard cards
trade       — swap widget, migration
dca         — DCA vault management (largest namespace)
assets      — holdings, PnL, stacking
notifications — alerts + history
ai          — AI insights chrome (labels only; AI output stays dynamic)
meta        — SEO titles/descriptions per route
```

### Changed files

- **`src/middleware.ts`** — compose the existing CORS handling (for `/api/*`) with
  the next-intl middleware (for page routes). Single middleware file delegates by
  path: API requests run CORS logic; page requests run next-intl. `matcher` updated
  to cover both page routes and `/api/:path*`, excluding static assets.
- **Move page routes into `src/app/[locale]/`**: `page.tsx`, `dashboard/`, `trade/`,
  `dca/` (incl. `dca/performance/`), `ai/`, `assets/`, `apps/`, `bubbles/`,
  `notifications/`. `api/` stays at `src/app/api/`.
- **`src/app/[locale]/layout.tsx`** — set `<html lang={locale}>`, wrap children in
  `NextIntlClientProvider`, add `generateStaticParams` (en, vi) and localized
  `generateMetadata` with `hreflang` alternates. Fonts and `layout-client.tsx`
  unchanged.
- **`error.tsx` / `not-found.tsx`** — placed/handled per next-intl App Router
  conventions so they render inside the locale context.
- **Internal navigation sweep** — replace `next/link` `Link` and `next/navigation`
  `useRouter`/`usePathname`/`redirect` usages in app components with the wrappers
  from `src/i18n/navigation` so locale is preserved across navigation.
- **`src/app/sitemap.ts`** — emit entries for each locale (English unprefixed,
  Vietnamese under `/vi`).

## Migration strategy (incremental — app stays green at every step)

1. **Infrastructure**: add `routing.ts`, `navigation.ts`, `request.ts`, install
   `next-intl`, compose middleware, move routes into `[locale]/`, wire
   `NextIntlClientProvider`. Strings remain hardcoded English — app runs normally.
2. **Extract**: pull current English strings into `messages/en.json` (the source of
   truth), then translate into `messages/vi.json`.
3. **Refactor by namespace**: convert components one namespace at a time
   (`nav` first, then page by page). Each step is its own commit and stays green.

## Error handling

- Unknown/unsupported locale in the URL → `notFound()`.
- Missing translation key → fall back to the `en` value (no broken UI).
- API routes are unaffected by locale resolution.

## Testing

- **Unit (vitest)**: assert `vi.json` contains every key present in `en.json`
  (catches untranslated/missing keys); assert routing config shape.
- **E2E (Playwright)**: language switch keeps the user on the same logical page;
  middleware redirect/locale detection works; `<html lang>` matches the active
  locale; `/vi/dashboard` renders Vietnamese while `/dashboard` renders English.

## Out of scope (YAGNI)

- Translating dynamic API content (prices, news) or AI output.
- RTL languages / locale-specific number-currency reformatting beyond what
  next-intl provides out of the box.
- Per-user persisted language preference on the server (cookie is sufficient).

## Risks / watch-items

- **Single middleware file**: Next.js allows only one — CORS + next-intl must be
  composed carefully and both matchers verified.
- **Navigation sweep completeness**: any missed `Link`/`router.push` drops the
  locale on click; needs a thorough grep + e2e coverage.
- **E2E path references**: existing specs that hardcode paths may need updates for
  the Vietnamese-prefixed routes.
- **Stray file**: `src/app/page 2.tsx` (untracked) appears to be an accidental
  duplicate; confirm and remove during cleanup rather than moving it into `[locale]`.
