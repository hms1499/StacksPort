# Direct-swap domain extraction — pilot for domain/infra/app layering

**Date:** 2026-05-23
**Status:** Approved for implementation
**Scope:** Pilot refactor of `src/lib/direct-swap.ts` only. No other module is touched.

## Background

Roadmap item #1 from the 2026-05-22 system-design review proposed separating pure domain logic from blockchain I/O so business rules can be tested without network mocks. The full goal is to apply this across `dca.ts`, `dca-sbtc.ts`, `stacks.ts`, and `direct-swap.ts`. This spec covers only the pilot on `direct-swap.ts` — selected because it already has characterization tests that prove byte-identical behavior across refactors, and because its data (`ROUTE_TABLE`) is already structured as pure values.

Pilot success criteria:

1. Pattern validated on a low-risk module before applying to harder ones.
2. Public API of `@/lib/direct-swap` byte-identical — all 4 consumers (`SwapWidget`, `SwapPairChart`, `useMarketData`, `market-snapshot`) plus the test file compile and behave the same.
3. `npm run build` and `direct-swap.test.ts` green at every commit.

Out of scope: `dca.ts`, `dca-sbtc.ts`, `stacks.ts`, dependency injection, new test files, runtime behavior changes.

## Three-layer model

The pilot establishes three layers under `src/lib/`:

- **`domain/`** — Pure business logic. No `fetch`, no Hiro calls, no Redis. Tests run without any mocks. May import `@stacks/transactions` because those constructors are pure CV value-objects, not I/O.
- **`infra/`** — Adapters for external systems. One file per system. Imports domain types only.
- **`app/`** — Orchestrators that compose domain rules with infra adapters. The only layer aware of both.

Direction of imports: `app → infra → (none)` and `app → domain → (none)`. `domain/` never imports from `infra/` or `app/`. `infra/` never imports from `app/`.

## Target file layout

```
src/lib/
├── direct-swap.ts                # barrel re-export — public API surface unchanged
├── direct-swap.test.ts           # unchanged, still imports from "./direct-swap"
├── domain/
│   └── swap/
│       ├── tokens.ts             # SwapToken, SWAP_TOKENS, SWAP_TOKEN_USD, SWAP_PRICE_GECKO_IDS
│       ├── routes.ts             # SwapRoute, RouteSpec, QuoteHop, ExecSpec, TokenRef,
│       │                          # ROUTE_TABLE, getRoute, getValidDestinations,
│       │                          # getSwappableFromTokens
│       ├── amount.ts             # toRawAmount, applySlippageFloor, sanitizeAmountInput,
│       │                          # amountForPercent, exceedsBalance
│       ├── limits.ts             # MIN_SWAP_RAW, STX_GAS_RESERVE, MIN_STX_FOR_FEE,
│       │                          # minSwapHuman, isBelowMinSwap, lacksStxForFee,
│       │                          # slippageWarning
│       ├── quote-math.ts         # QuoteResult, quoteRate, computePriceImpact,
│       │                          # QUOTE_TTL_MS, isQuoteStale, quoteSecondsLeft
│       ├── usd.ts                # resolveUnitUsd, formatUsd
│       └── clarity.ts            # SwapParams, cvToHex, unwrapOkUint,
│                                  # senderSpendPostCondition, buildSwapParams
├── infra/
│   └── stacks/
│       └── read-only.ts          # callReadOnly (fetch Hiro → ClarityValue)
└── app/
    └── swap/
        └── quote.ts              # getQuote (orchestrator), quoteHop, quoteRawOut
```

`ROUTE_TABLE` lives in `domain/swap/routes.ts`. It references token contract constants (`SBTC`, `WSTX`, `AEUSDC`, `USDCX`, pool contracts, router contracts, core contracts). Those constants are mainnet addresses — pure data with no I/O — and live alongside `ROUTE_TABLE` in `routes.ts`. Token registry constants (`SBTC`, `USDCX` as `TokenRef`) are referenced from both `tokens.ts` (display registry) and `routes.ts` (on-chain references). To avoid duplication, the contract constants live in `routes.ts` (the on-chain canonical reference) and `tokens.ts` imports the addresses it needs for the `SWAP_TOKENS` display entries.

## Public API contract

After the refactor, `src/lib/direct-swap.ts` is a barrel of re-exports. Every symbol currently exported from it must remain importable from the same path with the same name and type signature.

Current exports (30 symbols, verified via `grep -c "^export" src/lib/direct-swap.ts`):

- Types: `SwapToken`, `SwapRoute`, `QuoteResult`, `SwapParams`
- Token data: `SWAP_TOKENS`, `SWAP_TOKEN_USD`, `SWAP_PRICE_GECKO_IDS`
- Route resolvers: `getRoute`, `getValidDestinations`, `getSwappableFromTokens`
- Amount math: `toRawAmount`, `applySlippageFloor`, `sanitizeAmountInput`, `amountForPercent`, `exceedsBalance`
- Limits/validation: `STX_GAS_RESERVE`, `MIN_STX_FOR_FEE`, `minSwapHuman`, `isBelowMinSwap`, `lacksStxForFee`, `slippageWarning`
- Quote helpers: `quoteRate`, `computePriceImpact`, `QUOTE_TTL_MS`, `isQuoteStale`, `quoteSecondsLeft`
- USD: `resolveUnitUsd`, `formatUsd`
- Swap building: `buildSwapParams`
- Orchestrator: `getQuote`

The barrel uses `export * from "./domain/swap/<file>"` and named re-exports for the orchestrator. Any new symbol added to a domain file surfaces automatically.

## Testing strategy

- `direct-swap.test.ts` is the safety net. It runs against the barrel and proves the route table interpretation is byte-identical after each commit.
- No new tests are required for the pilot. Each domain file *could* be tested independently without mocks (that is the point), but adding those is a follow-up — not a gate for pilot completion.
- `npm run build` must pass after every commit (TypeScript catches missing re-exports).

## Implementation order

Six commits, each leaves the repo green (tests + build):

1. **Scaffold** — create empty `src/lib/domain/swap/`, `src/lib/infra/stacks/`, `src/lib/app/swap/` directories (with a `.gitkeep` or first stub file to make git track them).
2. **Move pure data + types** — extract `tokens.ts` and `routes.ts`. Replace bodies in `direct-swap.ts` with `export * from`. Verify `direct-swap.test.ts` passes.
3. **Move math + validation** — extract `amount.ts`, `limits.ts`, `quote-math.ts`, `usd.ts`. Update barrel. Tests pass.
4. **Move clarity helpers** — extract `clarity.ts` (`cvToHex`, `unwrapOkUint`, `senderSpendPostCondition`, `buildSwapParams`, `SwapParams` type). Update barrel. Tests pass.
5. **Move infra adapter** — extract `infra/stacks/read-only.ts` (`callReadOnly`). Internal to `direct-swap.ts` orchestrator at this step — not re-exported because it was never public. Tests pass.
6. **Move orchestrator** — extract `app/swap/quote.ts` (`getQuote`, `quoteHop`, `quoteRawOut`). `direct-swap.ts` is now ~10–15 lines of re-exports. Final test + build pass.

Per the project convention ([[feedback-commits]] in memory): no Co-Authored-By trailer, fine-grained commits, each green.

## What's explicitly NOT in this pilot

- No touching `dca.ts`, `dca-sbtc.ts`, `stacks.ts`. Each is a future pilot.
- No dependency injection or port/adapter interfaces. Module imports are the interface. Add DI only when a real need (e.g., swapping infra in tests) appears.
- No new test files. Characterization tests already cover the refactor.
- No runtime behavior changes. Any output diff is a refactor bug, not a feature.
- No ESLint rule to enforce layer boundaries. Add if drift becomes a problem; not a pilot gate.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Consumer imports break | Barrel re-exports preserve every name and path. TS build catches gaps. |
| Circular imports between layers | `domain/` never imports outward; verified by `grep` in each commit. |
| Quote behavior changes silently | `direct-swap.test.ts` (427 lines, characterization-style) blocks any byte diff. |
| Barrel drift over time | `export * from` propagates new symbols automatically; review at end of pilot. |

## Follow-ups (after pilot)

- Apply the same pattern to `dca.ts` + `dca-sbtc.ts` in a future session.
- Apply to `stacks.ts` (largest, riskiest — go last).
- Consider an ESLint `no-restricted-imports` rule to enforce layer direction.
- Consider whether the barrel `src/lib/direct-swap.ts` should be deprecated and consumers migrated to deep imports, or kept as the stable public path.
