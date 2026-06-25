# Unified Transaction UX — `TxSheet` (Design)

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Scope (Milestone 1):** A shared transaction shell + headless state machine, proven by
refactoring the three Earn modals (`StakeStxModal`, `SupplyZestModal`, `WithdrawZestModal`).
Swap and DCA migration are **out of scope** (Milestone 2).

## Why

StacksPort is heading toward a "super-app" with many on-chain actions. Today there are
~20 bespoke modals and only 4 use the shared `ui/dialog`/`ui/sheet` primitives. The three
Earn modals each re-implement the same flow: overlay chrome, amount input + Max + balance,
validation/error display, a "you'll receive" estimate, a submit button with a loading
state, a post-submit success view with an explorer link, and `trackTx` + `addNotification`
wiring. Every new on-chain feature copies this again — a per-feature consistency and
maintenance tax. A single transaction pattern (review → sign → status → next-action) is the
foundation every future action builds on, so it is the right first pillar.

Decisions locked during brainstorming:
- **Milestone scope:** the 3 Earn modals only (proof), not Swap/DCA.
- **Review:** inline — form and a review summary share one screen; the review block appears
  below the body once the amount is valid, and the submit button reads "Confirm in wallet".
  No extra click, no separate Back step.
- **Presentation:** responsive — mobile bottom-sheet (slides up from the bottom, one-handed),
  desktop centered dialog. Built on Radix `Dialog` + CSS design tokens.
- **Abstraction shape:** headless hook (`useTxFlow`) + presentational shell (`<TxSheet>`),
  plus a shared `<AmountField>`. Chosen over a config-driven single component (too rigid for
  the varying bodies Swap/DCA will need) and compound components (unnecessary API surface for
  three near-identical modals).

## Architecture & File Layout

```
src/components/tx/
  TxSheet.tsx        # presentational shell: responsive Radix Dialog + slots + success view
  AmountField.tsx    # input + Max + balance + error (shared by the 3 modals)
  ReviewRows.tsx     # small label/value list for the inline review block
  useTxFlow.ts       # headless state machine (unit-testable)
  useTxFlow.test.ts  # unit tests for the state machine
  types.ts           # TxPhase, TxDriver, NextAction, TxSheetProps
```

`src/lib/tx-tracker.ts` — extend `TrackTxOptions` with an optional `onResolved?(status:
"success" | "failed")` callback. Existing call-sites are unaffected (optional field); the
notification + `invalidatePortfolio` behavior is unchanged. `useTxFlow` passes `onResolved`
so an open sheet can upgrade its phase to `confirmed`/`failed`.

## State Machine — `useTxFlow`

```
phase: "form" → "submitting" → "submitted" → ("confirmed" | "failed")
```

| Phase        | Trigger                          | UI                                                        |
|--------------|----------------------------------|-----------------------------------------------------------|
| `form`       | default                          | body (AmountField) + inline review when valid             |
| `submitting` | Confirm pressed, awaiting wallet | "Confirm in wallet…" disabled + spinner                   |
| `submitted`  | wallet returns `txId`            | success view: explorer link + next-actions (terminal-enough) |
| `confirmed` / `failed` | `trackTx.onResolved` fires (only if sheet still open) | upgrade badge ✓ / ✗                  |

`submitted` is terminal-enough: next-actions are available immediately so the user can close
and move on without waiting for on-chain confirmation (~15s–minutes). If they keep the sheet
open, it upgrades to `confirmed`/`failed`.

Hook API:

```ts
const tx = useTxFlow({
  driver,            // (onFinish: ({txId}) => void, onCancel: () => void) => void  — wraps a domain fn
  label,             // forwarded to trackTx notification ("Supply", "Stake", …)
  category,          // NotificationCategory
  context,           // NotificationContext
  address,           // wallet address — forwarded to trackTx for cache invalidation
  addNotification,   // from notificationStore
});
// tx.phase, tx.txId, tx.submit(), tx.reset()
```

`submit()` sets `submitting`, calls `driver(onFinish, onCancel)`:
- `onFinish({txId})` → set `submitted` + `txId`; `addNotification(submitted)`; call
  `trackTx({ txId, label, category, context, address, addNotification, onResolved })`.
- `onResolved("success")` → `confirmed`; `onResolved("failed")` → `failed`.
- `onCancel` (user rejected in wallet) or a thrown error → back to `form`, no noisy toast
  (preserves current behavior).
- `reset()` → `form` (also runs when the sheet re-opens).

The hook does no fetching — it only orchestrates — so it is unit-testable with a fake driver.

## Components

### `<TxSheet>`
Props:
```ts
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: { icon: React.ElementType; iconBg: string; iconColor?: string; title: string; subtitle?: string };
  children: React.ReactNode;     // body shown during `form` (typically <AmountField>)
  review?: React.ReactNode;      // inline review block, shown below body when present
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  phase: TxPhase;
  txId: string | null;
  nextActions?: NextAction[];
}
```
**Submit button label by phase** (resolves the mockup's "Confirm in wallet"): in `form` the
button shows `submitLabel` (the action verb, e.g. "Supply"/"Stake"); in `submitting` it shows
the localized `tx.confirmInWallet` ("Confirm in wallet…") and is disabled with a spinner. This
mirrors the current modals' `supplyCta` → `pending` text transition.

Internals: Radix `Dialog`. Responsive via classes — desktop centered (`max-w-sm`), mobile
docked to bottom (`inset-x-0 bottom-0`, slide-up). Surface uses `glass-card` + design tokens
(NOT the existing `sheet.tsx`, whose shadcn `bg-background`/`text-muted-foreground` classes
are no-ops in this CSS-var design system). Renders the success view itself when
`phase ∈ {submitted, confirmed, failed}` from `txId` + `nextActions` (explorer link, status
badge, next-action links). Closing is wired through `onOpenChange`.

### `<AmountField>`
Props: `value`, `onChange`, `label`, `onMax`, `balanceLabel`, `error`, `placeholder`,
`decimals`. Wraps the amount input + Max button + balance line + red error line. Validation
stays in `lib/domain/*`; the field is presentation only. Digit/decimal sanitizing on input
matches the current modals (`replace(/[^0-9.]/g, "")`).

### `<ReviewRows>`
Props: `rows: Array<[label: string, value: string]>`. Renders the inline review summary
(label left, value right) under a small "Review" heading. Tokenized.

### `NextAction`
`{ label: string; href: string }`. Declared per call-site. Examples: after Supply →
"View position" → `/earn`; after Stake → "Track stacking" → `/earn`.

## Call-site Shape (refactored modal)

```tsx
const tx = useTxFlow({
  driver: (onFinish, onCancel) => supplyZestSbtc(amountSats, stxAddress, onFinish, onCancel),
  label: t("zest.supplyCta"), category: "wallet",
  context: { tokenSymbol: "sBTC", amount, action: "created" },
  address: stxAddress, addNotification,
});

return (
  <TxSheet open={open} onOpenChange={(o) => !o && onClose()}
    header={{ icon: Bitcoin, iconBg: "rgba(247,147,26,0.14)", iconColor: "#F7931A", title: t("zest.supplyTitle") }}
    phase={tx.phase} txId={tx.txId}
    submitLabel={t("zest.supplyCta")} canSubmit={validation.ok} onSubmit={tx.submit}
    review={validation.ok && <ReviewRows rows={[
      [t("zest.amountLabel"), `${amount} sBTC`],
      [t("zest.receiveEst", { amount: estZ.toFixed(8) }), ""],
    ]} />}
    nextActions={[{ label: tz("tx.nextEarn"), href: "/earn" }]}
  >
    <AmountField value={amount} onChange={setAmount} onMax={setMax}
      label={t("zest.amountLabel")}
      balanceLabel={`${t("zest.available")}: ${availableSbtc.toFixed(8)} sBTC`}
      error={errorText} decimals={8} placeholder="0.00000000" />
  </TxSheet>
);
```

Each modal sheds ~60–80 lines of boilerplate (overlay, success view, `trackTx` wiring,
submit/loading). Domain logic (validate/estimate) is unchanged — only presentation moves into
slots. `IdleStxNudge` is unchanged (it just opens `StakeStxModal`).

## Error Handling
- **Validation** stays in `lib/domain/*`; `canSubmit = validation.ok` disables the button;
  errors surface via `AmountField.error`.
- **User rejects in wallet / throw** → `onCancel` returns phase to `form`, no noisy toast.
- **Submitted but tx fails on-chain** → `trackTx.onResolved("failed")` → ✗ badge + existing
  error notification + `invalidatePortfolio`.
- **Sheet closed mid-flight** → `trackTx` keeps running (fire-and-forget), so confirm/fail
  still reaches the notification drawer even with the sheet closed.

## Testing
- `useTxFlow.test.ts` (vitest, headless): fake driver → assert `form → submitting →
  submitted`; `onResolved("success" | "failed")` → `confirmed`/`failed`; `onCancel` → `form`;
  `reset()` → `form`. Mock `trackTx` and `addNotification`.
- Existing `e2e/earn-stake.spec.ts` **must stay green** unmodified (mock wallet → stacking
  row opens sheet → "Stake STX" visible). Add one assertion: after a mocked submit
  (`onFinish`), the sheet shows the explorer link + a next-action.
- Per-commit gate: `eslint` + `tsc` + relevant `vitest` + `messages.test.ts`. Final gate:
  `npm run build` + the earn e2e.

## i18n
Add a minimal `earn.tx` block to all 7 locales (keep the parity test green):
`reviewTitle` ("Review"), `confirmInWallet`, `submitted`, `confirmed`, `failed`,
`viewOnExplorer`, `nextEarn` ("View position"). Reuse existing per-modal title/button keys
(`zest.*`, `assets.stake.*`).

## Non-goals (YAGNI)
- No Swap/DCA migration (Milestone 2).
- No token selector, fee estimator, multi-step wizard.
- No change to `tx-tracker` polling behavior (only an additive optional callback).
- No changes to the legacy `sheet.tsx` / `dialog.tsx`.

## Milestone 2 (future, not now)
Once the abstraction is proven on Earn, migrate the Swap widget and DCA create/edit — these
introduce a `<TokenSelect>` body and possibly multi-leg review rows, which is exactly why the
body is a slot rather than config.
