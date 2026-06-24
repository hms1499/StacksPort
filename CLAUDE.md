# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
npm run test:e2e     # Run all Playwright tests (desktop + mobile)
npm run test:e2e:ui  # Run tests with Playwright UI for debugging
```

Run a single Playwright test file:
```bash
npx playwright test e2e/dca.spec.ts
npx playwright test e2e/dca.spec.ts --project=chromium
```

### Keeper Bot
```bash
cd keeper-bot && npm run dev   # Run bot in watch mode
cd keeper-bot && npm run build # Compile TypeScript
```

The bot is a one-shot cron, not a long-running process — each invocation acquires a Redis lock (`keeper-bot:run-lock`, TTL 5min) so overlapping cron runs exit cleanly instead of broadcasting duplicate batches. Hiro RPC calls go through a sliding-window circuit breaker (5/10 fails → open 60s) so a degraded RPC fails the run fast instead of burning through retries. Every broadcast records `{ txid, planIds, status }` to `keeper:recent-batches`; the next run reconciles pending entries and Telegrams the operator on aborts. End-of-run heartbeat goes to `keeper:last-run`, surfaced at `GET /api/keeper/health` (200 = healthy, 503 = degraded) for an external uptime monitor.

### Smart Contracts
```bash
cd contracts && clarinet check  # Validate Clarity contracts
cd contracts && clarinet test   # Run contract unit tests
```

## Architecture

StacksPort is a non-custodial DCA (Dollar-Cost Averaging) and portfolio management platform on the Stacks blockchain. Users can automate recurring STX→sBTC and sBTC→USDCx swaps via Bitflow DEX.

### Key Directories

- **`src/app/`** — Next.js 15 App Router pages and API routes
  - `dashboard/` — Portfolio overview, market stats, news
  - `trade/` — Swap widget and aeUSDC migration
  - `dca/` — DCA vault management (the primary feature)
  - `assets/` — Holdings, PnL, stacking tracker
  - `notifications/` — Alerts and notification history
  - `ai/` — Stacks AI insights (Groq-powered)
  - `api/` — Server-side proxy routes for Bitflow, CoinGecko, news
- **`src/components/`** — Feature-organized React components (ui/, trade/, dca/, assets/)
- **`src/store/`** — Four Zustand stores: `walletStore`, `notificationStore`, `priceAlertStore`, `themeStore`
- **`src/hooks/`** — Custom hooks with SWR for data fetching (`useMarketData`, `useWalletSync`, etc.)
- **`src/lib/`** — Core utilities: `stacks.ts` (blockchain), `bitflow-server.ts` (DEX), `dca.ts` / `dca-sbtc.ts` (vault logic)
  - **`src/lib/server/`** — Server-only aggregators that the snapshot endpoints consume (`market-snapshot.ts`, `portfolio-snapshot.ts`, `news.ts`, `keeper-health.ts`). Anything that imports here must be a route handler or another server module — never a client component.
- **`contracts/`** — Clarity 3 smart contracts (deployed on Stacks Mainnet)
- **`keeper-bot/`** — Node.js bot that auto-executes DCA plans on a schedule
- **`e2e/`** — Playwright tests across 3 browser profiles (desktop, iPhone 14, Pixel 7)

### State Management

All global state lives in Zustand stores — no Redux, no React Context. Each store exports a single hook with state + actions. Components read directly from stores via hooks.

`priceAlertStore` is a special case: the server (Redis, evaluated by `keeper-bot/src/price-push.ts`) is the source of truth for `isActive` / `triggeredAt` / `lastPushedAt`. The client store mirrors via `useAlertsHydration` (mounted in `layout-client.tsx`) which SWR-fetches `/api/price-alerts` every 30s. Mutations still flow through the existing register sync; resets go through `/api/price-alerts/reset` because the register merge defends triggered state against stale client writes.

### Blockchain Integration

- **`@stacks/transactions`** — Contract calls, transaction building
- **`@stacks/connect`** / **`@stacks/connect-ui`** — Wallet connection (Leather, Xverse)
- **`@bitflowlabs/core-sdk`** — Swap quotes and routing via Bitflow DEX
- Contract address: `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV` (mainnet)

### Smart Contract Constraints
- Min swap: 1 STX / 334 sats sBTC
- Max plans per user: 10
- Min initial deposit: 2 STX / 668 sats

### Adding a Swap Pair (ROUTE_TABLE)

All swap routing lives in **one** place: `ROUTE_TABLE` in [src/lib/direct-swap.ts](src/lib/direct-swap.ts). `getQuote`, `buildSwapParams`, `getRoute`, `getValidDestinations`, and `getSwappableFromTokens` all interpret it — adding a pair is a data edit, not a logic change.

To add a route, append one `RouteSpec` object:
- `from` / `to` — token ids (must exist in `SWAP_TOKENS`)
- `method` — `"router"` (aggregator entrypoint) or `"direct"` (raw xyk-core)
- `hops` — display labels for the route path UI
- `quote` — ordered `QuoteHop[]`; each is a real on-chain read (`get-dx`/`get-dy` on a pool via a core contract). Output of hop N feeds hop N+1.
- `exec` — the on-chain call: `{ kind: "router", contract, fn }` or `{ kind: "direct", contract, fn, pool, xToken, yToken }`

TypeScript flags any missing field at compile time, so a half-wired route can't reach sign time. Rules:
1. **Every new pool/router/token contract must actually exist on-chain.** Verify the contract id + SIP-010 asset name against the Hiro API — never guess them.
2. If the route introduces a **new source token** (a new `from`), add a branch to `senderSpendPostCondition` (it maps input token → STX `ustx` vs FT post-condition). This is intentionally not in the table.
3. The characterization tests in `src/lib/direct-swap.test.ts` must stay green — they prove existing routes are byte-identical. Add new characterization cases for the new route.
4. Run `npm test` (unit) and `npm run build` before committing.

### API Routes (Next.js)

API routes in `src/app/api/` act as server-side proxies to avoid CORS and hide API keys. Direct blockchain calls happen client-side via Stacks SDK.

**Snapshot pattern (dashboard).** Dashboard data flows through two cached aggregator endpoints instead of many per-card SWR fetches:

- `/api/market/snapshot` — shared across all users. Bundles trending tokens, STX market stats + 7d history, PoX cycle, fear & greed, news, swap prices. Vercel Runtime Cache, TTL 60s, tag `market`.
- `/api/portfolio/snapshot?address=…` — per-wallet. Bundles portfolio value, fungible tokens, tokens-with-values, top-20 transactions, DCA plans, PnL. TTL 30s, tags `[portfolio, portfolio:<address>]`.
- `/api/portfolio/invalidate` (POST `{ address }`) — busts the per-address tag after a tx confirms so the next read recomputes immediately. `trackTx` calls this on success/abort; pass `address` when calling `trackTx` from new tx sites.

When adding a new dashboard card, prefer extending the relevant snapshot (lib + selectors in `useMarketSnapshot.ts` / `usePortfolioSnapshot.ts`) over adding a standalone SWR hook.

### Animations

GSAP is used for complex timeline animations (hero sections). Framer Motion handles component-level transitions. `src/lib/gsap.ts` and `src/lib/animations.ts` are the entry points.

### Testing

E2E tests use Playwright with a mock wallet fixture in `e2e/fixtures/test-utils.ts`. Tests run against three browser profiles. Expected baseline: ~84 tests passing on desktop, ~78 on mobile.

### Environment Variables

Frontend (`.env.local`):
- `GROQ_API_KEY` — AI insights
- `NEXT_PUBLIC_CONTRACT_ADDRESS` — DCA vault contract
- `BITFLOW_API_KEY` — Optional Bitflow API key
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Redis (push subs, keeper health, price alerts). Without these, `/api/keeper/health` and `/api/price-alerts` fall back to empty/error responses.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web push delivery
- `KEEPER_HEALTH_MAX_RUN_AGE_SECONDS` (default 900), `KEEPER_HEALTH_ABORT_TAIL_LIMIT` (default 3) — tune health endpoint thresholds
- `SBTC_NETWORK` (`testnet` | `mainnet`, default `mainnet`) — network for the BTC→sBTC deposit on-ramp. Build & smoke on `testnet` first.
- `SBTC_EMILY_API_URL` — Emily deposit-status API base (defaults to `https://sbtc-emily.com`); used by the reconcile cron to poll mint completion.
- `SBTC_MEMPOOL_API_URL` — optional mempool.space API base override (defaults to `https://mempool.space/api`) for the reconcile mempool check.
- `CRON_SECRET` — bearer token guarding `GET /api/cron/sbtc-reconcile` (the external scheduler calls it with `Authorization: Bearer <CRON_SECRET>`). Without it the route 401s.

Keeper bot (`keeper-bot/.env`):
- `KEEPER_PRIVATE_KEY`, `KEEPER_ADDRESS` — Bot wallet credentials
- `CONTRACT_ADDRESS`, `HIRO_API_URL` — Contract and RPC config
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Lock, heartbeat, failure tracker, push subs (required)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web push for DCA execution + price alert notifications
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Optional operator alerts (batch executed, batch aborted, consecutive-abort page)
