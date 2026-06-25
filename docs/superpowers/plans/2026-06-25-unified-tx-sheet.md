# Unified Transaction UX (`TxSheet`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared transaction shell (`<TxSheet>`) + headless state machine (`useTxFlow`) + `<AmountField>`, and prove it by refactoring the three Earn modals.

**Architecture:** A pure `txReducer` drives phases `form → submitting → submitted → confirmed/failed`; `useTxFlow` wraps it and wires the wallet submit driver + `trackTx`. `<TxSheet>` is a responsive Radix `Dialog` (bottom-sheet on mobile, centered on desktop) styled with CSS design tokens, rendering header/body/review/footer slots and a standard success view. Each Earn modal keeps its domain math and just declares slots.

**Tech Stack:** Next.js 15 + React, TypeScript, `radix-ui` (`Dialog`), vitest (node env — logic tests only), Tailwind + CSS-var design tokens, next-intl.

## Global Constraints

- Commit style: **no `Co-Authored-By` trailer**; commit at fine granularity (RED/GREEN or helper/wiring separate), each commit green. Commit directly on `main` (no feature branch).
- No `@testing-library/react` / jsdom in this repo — vitest runs in **node env**. Unit-test pure logic only (`txReducer`, `tx-tracker`). Presentational components (`AmountField`, `ReviewRows`, `TxSheet`) are verified by `npm run build` + the earn e2e, NOT unit tests.
- Design system is **CSS-var based**: use `var(--text-primary)`, `var(--text-muted)`, `var(--accent)`, `var(--bg-elevated)`, `var(--border-subtle)`, `glass-card`. Do NOT use shadcn classes (`bg-background`, `text-muted-foreground`) — they are no-ops here. Do NOT reuse the legacy `src/components/ui/sheet.tsx`.
- i18n parity: every new key must exist in all 7 locales (`en, vi, zh, ja, ko, es, pt`) or `src/i18n/messages.test.ts` fails.
- Radix import form used in this repo: `import { Dialog } from "radix-ui"`.
- Explorer link format: `https://explorer.hiro.so/txid/${txId}?chain=mainnet`.
- Scope is the 3 Earn modals ONLY. Do NOT touch Swap, DCA, `tx-tracker` polling cadence, or legacy `sheet.tsx`/`dialog.tsx`.

---

### Task 1: Add optional `onResolved` callback to `trackTx`

**Files:**
- Modify: `src/lib/tx-tracker.ts`
- Test: `src/lib/tx-tracker.test.ts` (create)

**Interfaces:**
- Produces: `TrackTxOptions` gains `onResolved?: (status: "success" | "failed") => void`. `trackTx` calls it once when the tx resolves (after the existing notification + `invalidatePortfolio`). Existing behavior unchanged when omitted.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tx-tracker.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Avoid the real invalidate network call.
vi.mock("@/lib/invalidate", () => ({ invalidatePortfolio: vi.fn() }));

import { trackTx } from "./tx-tracker";

describe("trackTx onResolved", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("calls onResolved('success') when the tx confirms", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ tx_status: "success" }),
    })));
    const onResolved = vi.fn();
    const addNotification = vi.fn();

    trackTx({ txId: "0xabc", label: "Supply", category: "wallet", addNotification, onResolved });

    // Initial 15s delay then first poll.
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onResolved).toHaveBeenCalledWith("success");
    expect(addNotification).toHaveBeenCalled();
  });

  it("calls onResolved('failed') on abort", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ tx_status: "abort_by_post_condition" }),
    })));
    const onResolved = vi.fn();

    trackTx({ txId: "0xdef", label: "Supply", category: "wallet", addNotification: vi.fn(), onResolved });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onResolved).toHaveBeenCalledWith("failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tx-tracker.test.ts`
Expected: FAIL — `onResolved` is not part of `TrackTxOptions` / not called.

- [ ] **Step 3: Implement the callback**

In `src/lib/tx-tracker.ts`, add to the `TrackTxOptions` interface (after `address?`):

```ts
  // Optional: invoked once when the tx resolves, so an open UI (e.g. TxSheet)
  // can upgrade its state. Fires after the notification + invalidate.
  onResolved?: (status: 'success' | 'failed') => void;
```

Update the `trackTx` signature destructure to include `onResolved`, then in the `poll` function:
- in the `status === 'success'` branch, after `invalidatePortfolio(address);` add: `onResolved?.('success');`
- in the `else` (abort) branch, after `invalidatePortfolio(address);` add: `onResolved?.('failed');`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tx-tracker.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tx-tracker.ts src/lib/tx-tracker.test.ts
git commit -m "feat(tx): optional onResolved callback on trackTx"
```

---

### Task 2: `txReducer` + `useTxFlow` hook + shared types

**Files:**
- Create: `src/components/tx/types.ts`
- Create: `src/components/tx/useTxFlow.ts`
- Test: `src/components/tx/useTxFlow.test.ts`

**Interfaces:**
- Consumes: `trackTx` + `TrackTxOptions.onResolved` (Task 1).
- Produces:
  - `type TxPhase = "form" | "submitting" | "submitted" | "confirmed" | "failed"`
  - `type NextAction = { label: string; href: string }`
  - `type TxDriver = (onFinish: (r: { txId: string }) => void, onCancel: () => void) => void`
  - `type TxState = { phase: TxPhase; txId: string | null }`
  - `type TxAction = { type: "SUBMIT" } | { type: "FINISH"; txId: string } | { type: "RESOLVE"; status: "success" | "failed" } | { type: "CANCEL" } | { type: "RESET" }`
  - `txReducer(state: TxState, action: TxAction): TxState`
  - `useTxFlow(opts): { phase: TxPhase; txId: string | null; submit: () => void; reset: () => void }`

- [ ] **Step 1: Write the failing reducer test**

Create `src/components/tx/useTxFlow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { txReducer } from "./useTxFlow";

const form = { phase: "form", txId: null } as const;

describe("txReducer", () => {
  it("SUBMIT moves form → submitting", () => {
    expect(txReducer(form, { type: "SUBMIT" })).toEqual({ phase: "submitting", txId: null });
  });
  it("FINISH moves submitting → submitted with txId", () => {
    const s = txReducer(form, { type: "SUBMIT" });
    expect(txReducer(s, { type: "FINISH", txId: "0x1" })).toEqual({ phase: "submitted", txId: "0x1" });
  });
  it("RESOLVE success → confirmed, keeps txId", () => {
    const s = { phase: "submitted", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESOLVE", status: "success" })).toEqual({ phase: "confirmed", txId: "0x1" });
  });
  it("RESOLVE failed → failed, keeps txId", () => {
    const s = { phase: "submitted", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESOLVE", status: "failed" })).toEqual({ phase: "failed", txId: "0x1" });
  });
  it("CANCEL returns to form", () => {
    const s = txReducer(form, { type: "SUBMIT" });
    expect(txReducer(s, { type: "CANCEL" })).toEqual({ phase: "form", txId: null });
  });
  it("RESET returns to form from any state", () => {
    const s = { phase: "confirmed", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESET" })).toEqual({ phase: "form", txId: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/tx/useTxFlow.test.ts`
Expected: FAIL — cannot resolve `./useTxFlow` / `txReducer` undefined.

- [ ] **Step 3: Create the types file**

Create `src/components/tx/types.ts`:

```ts
import type { NotificationCategory, NotificationContext } from "@/types/notifications";

export type TxPhase = "form" | "submitting" | "submitted" | "confirmed" | "failed";

export type NextAction = { label: string; href: string };

/** Wraps a domain submit fn — calls onFinish with the txId, or onCancel on rejection. */
export type TxDriver = (
  onFinish: (r: { txId: string }) => void,
  onCancel: () => void,
) => void;

export type TxState = { phase: TxPhase; txId: string | null };

export type TxAction =
  | { type: "SUBMIT" }
  | { type: "FINISH"; txId: string }
  | { type: "RESOLVE"; status: "success" | "failed" }
  | { type: "CANCEL" }
  | { type: "RESET" };

export interface UseTxFlowOptions {
  driver: TxDriver;
  label: string;                 // forwarded to trackTx notification ("Supply", "Stake", …)
  category: NotificationCategory;
  context?: NotificationContext;
  address?: string | null;
  submittedMessage: string;      // toast shown the moment the wallet returns a txId
  addNotification: (
    message: string,
    type: "success" | "error" | "warning" | "info",
    category: NotificationCategory,
    duration?: number,
    context?: NotificationContext,
  ) => void;
}
```

- [ ] **Step 4: Implement `txReducer` + `useTxFlow`**

Create `src/components/tx/useTxFlow.ts`:

```ts
"use client";

import { useCallback, useReducer } from "react";
import { trackTx } from "@/lib/tx-tracker";
import type { TxState, TxAction, UseTxFlowOptions } from "./types";

export function txReducer(state: TxState, action: TxAction): TxState {
  switch (action.type) {
    case "SUBMIT":
      return { phase: "submitting", txId: null };
    case "FINISH":
      return { phase: "submitted", txId: action.txId };
    case "RESOLVE":
      return { phase: action.status === "success" ? "confirmed" : "failed", txId: state.txId };
    case "CANCEL":
    case "RESET":
      return { phase: "form", txId: null };
    default:
      return state;
  }
}

export function useTxFlow(opts: UseTxFlowOptions) {
  const [state, dispatch] = useReducer(txReducer, { phase: "form", txId: null });

  const submit = useCallback(() => {
    dispatch({ type: "SUBMIT" });
    opts.driver(
      ({ txId }) => {
        dispatch({ type: "FINISH", txId });
        opts.addNotification(opts.submittedMessage, "info", opts.category, 5000, {
          ...opts.context, txId, action: "created",
        });
        trackTx({
          txId,
          label: opts.label,
          category: opts.category,
          context: opts.context,
          address: opts.address,
          addNotification: opts.addNotification,
          onResolved: (status) => dispatch({ type: "RESOLVE", status }),
        });
      },
      () => dispatch({ type: "CANCEL" }),
    );
  }, [opts]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { phase: state.phase, txId: state.txId, submit, reset };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/tx/useTxFlow.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/tx/types.ts src/components/tx/useTxFlow.ts src/components/tx/useTxFlow.test.ts
git commit -m "feat(tx): txReducer state machine + useTxFlow hook"
```

---

### Task 3: `<AmountField>` presentational component

**Files:**
- Create: `src/components/tx/AmountField.tsx`

**Interfaces:**
- Produces: `AmountField` with props `{ value: string; onChange: (v: string) => void; label: string; onMax: () => void; balanceLabel: string; error?: string | null; placeholder?: string; maxLabel: string }`. Sanitizes input to digits + decimal point.

- [ ] **Step 1: Implement the component**

Create `src/components/tx/AmountField.tsx`:

```tsx
"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label: string;
  onMax: () => void;
  maxLabel: string;
  balanceLabel: string;
  error?: string | null;
  placeholder?: string;
}

export default function AmountField({
  value, onChange, label, onMax, maxLabel, balanceLabel, error, placeholder = "0.00",
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
        <button
          type="button"
          onClick={onMax}
          className="text-xs font-semibold py-1 -my-1 touch-manipulation"
          style={{ color: "var(--accent)" }}
        >
          {maxLabel}
        </button>
      </div>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
      />
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{balanceLabel}</p>
      {error && <p className="text-[11px]" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint src/components/tx/AmountField.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tx/AmountField.tsx
git commit -m "feat(tx): AmountField shared input component"
```

---

### Task 4: `<TxSheet>` shell + `<ReviewRows>`

**Files:**
- Create: `src/components/tx/ReviewRows.tsx`
- Create: `src/components/tx/TxSheet.tsx`

**Interfaces:**
- Consumes: `TxPhase`, `NextAction` (Task 2).
- Produces:
  - `ReviewRows` props `{ title: string; rows: Array<[string, string]> }`.
  - `TxSheet` props `{ open; onOpenChange: (o: boolean) => void; header: { icon: React.ElementType; iconBg: string; iconColor?: string; title: string; subtitle?: string }; children: React.ReactNode; review?: React.ReactNode; submitLabel: string; submittingLabel: string; canSubmit: boolean; onSubmit: () => void; phase: TxPhase; txId: string | null; statusCopy: { submitted: string; confirmed: string; failed: string; viewOnExplorer: string }; nextActions?: NextAction[] }`.

- [ ] **Step 1: Implement `ReviewRows`**

Create `src/components/tx/ReviewRows.tsx`:

```tsx
"use client";

interface Props {
  title: string;
  rows: Array<[string, string]>;
}

export default function ReviewRows({ title, rows }: Props) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1.5"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
          <span className="font-semibold font-data" style={{ color: "var(--text-primary)" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `TxSheet`**

Create `src/components/tx/TxSheet.tsx`:

```tsx
"use client";

import { Dialog } from "radix-ui";
import { X, ArrowUpRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { TxPhase, NextAction } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: { icon: React.ElementType; iconBg: string; iconColor?: string; title: string; subtitle?: string };
  children: React.ReactNode;          // body during `form`
  review?: React.ReactNode;           // inline review block, shown when valid
  submitLabel: string;
  submittingLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  phase: TxPhase;
  txId: string | null;
  statusCopy: { submitted: string; confirmed: string; failed: string; viewOnExplorer: string };
  nextActions?: NextAction[];
}

export default function TxSheet({
  open, onOpenChange, header, children, review,
  submitLabel, submittingLabel, canSubmit, onSubmit,
  phase, txId, statusCopy, nextActions = [],
}: Props) {
  const Icon = header.icon;
  const isDone = phase === "submitted" || phase === "confirmed" || phase === "failed";

  const statusLine =
    phase === "confirmed" ? { text: statusCopy.confirmed, color: "var(--accent)", icon: CheckCircle2 }
    : phase === "failed" ? { text: statusCopy.failed, color: "var(--negative)", icon: XCircle }
    : { text: statusCopy.submitted, color: "var(--text-primary)", icon: CheckCircle2 };
  const StatusIcon = statusLine.icon;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)" }} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 glass-card flex flex-col gap-4 p-5
            inset-x-0 bottom-0 rounded-t-2xl
            sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2
            sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: header.iconBg, color: header.iconColor }}>
                <Icon size={16} />
              </div>
              <div>
                <Dialog.Title className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {header.title}
                </Dialog.Title>
                {header.subtitle && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{header.subtitle}</p>
                )}
              </div>
            </div>
            <Dialog.Close aria-label="Close">
              <X size={18} style={{ color: "var(--text-muted)" }} />
            </Dialog.Close>
          </div>

          {isDone ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <StatusIcon size={18} style={{ color: statusLine.color }} />
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{statusLine.text}</p>
              </div>
              {txId && (
                <a className="text-xs font-semibold flex items-center gap-1 py-1 -my-1 touch-manipulation"
                   style={{ color: "var(--accent)" }}
                   href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                   target="_blank" rel="noopener noreferrer">
                  {statusCopy.viewOnExplorer} <ArrowUpRight size={11} />
                </a>
              )}
              {nextActions.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {nextActions.map((a) => (
                    <Link key={a.href + a.label} href={a.href}
                          className="w-full rounded-xl py-2.5 text-sm font-semibold text-center"
                          style={{ background: "var(--accent)", color: "#04130d" }}>
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {children}
              {review}
              <button
                type="button"
                disabled={!canSubmit || phase === "submitting"}
                onClick={onSubmit}
                className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "#04130d" }}
              >
                {phase === "submitting" && <Loader2 size={14} className="animate-spin" />}
                {phase === "submitting" ? submittingLabel : submitLabel}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/components/tx/TxSheet.tsx src/components/tx/ReviewRows.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/tx/TxSheet.tsx src/components/tx/ReviewRows.tsx
git commit -m "feat(tx): TxSheet responsive shell + ReviewRows"
```

---

### Task 5: i18n — `earn.tx` block for all 7 locales

**Files:**
- Modify: `messages/en.json`, `vi.json`, `zh.json`, `ja.json`, `ko.json`, `es.json`, `pt.json`

**Interfaces:**
- Produces: `earn.tx = { reviewTitle, confirmInWallet, submitted, confirmed, failed, viewOnExplorer, nextEarn }` in every locale.

- [ ] **Step 1: Write + run the injector script**

Create and run (from repo root) — this preserves key order and file formatting:

```bash
cat > /tmp/add_tx_i18n.py <<'PY'
import json, collections
blocks = {
 "en": {"reviewTitle":"Review","confirmInWallet":"Confirm in wallet…","submitted":"Submitted","confirmed":"Confirmed on-chain","failed":"Failed on-chain","viewOnExplorer":"View on Explorer","nextEarn":"View position"},
 "vi": {"reviewTitle":"Xem lại","confirmInWallet":"Xác nhận trong ví…","submitted":"Đã gửi","confirmed":"Đã xác nhận on-chain","failed":"Thất bại on-chain","viewOnExplorer":"Xem trên Explorer","nextEarn":"Xem vị thế"},
 "zh": {"reviewTitle":"确认","confirmInWallet":"在钱包中确认…","submitted":"已提交","confirmed":"已上链确认","failed":"上链失败","viewOnExplorer":"在浏览器中查看","nextEarn":"查看持仓"},
 "ja": {"reviewTitle":"確認","confirmInWallet":"ウォレットで確認…","submitted":"送信済み","confirmed":"オンチェーンで確認","failed":"オンチェーンで失敗","viewOnExplorer":"エクスプローラーで表示","nextEarn":"ポジションを見る"},
 "ko": {"reviewTitle":"확인","confirmInWallet":"지갑에서 확인…","submitted":"제출됨","confirmed":"온체인 확인됨","failed":"온체인 실패","viewOnExplorer":"익스플로러에서 보기","nextEarn":"포지션 보기"},
 "es": {"reviewTitle":"Revisar","confirmInWallet":"Confirma en la billetera…","submitted":"Enviada","confirmed":"Confirmada on-chain","failed":"Falló on-chain","viewOnExplorer":"Ver en Explorer","nextEarn":"Ver posición"},
 "pt": {"reviewTitle":"Revisar","confirmInWallet":"Confirme na carteira…","submitted":"Enviada","confirmed":"Confirmada on-chain","failed":"Falhou on-chain","viewOnExplorer":"Ver no Explorer","nextEarn":"Ver posição"},
}
for loc, blk in blocks.items():
    p = f"messages/{loc}.json"
    d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
    d["earn"]["tx"] = collections.OrderedDict(blk)
    json.dump(d, open(p,"w"), ensure_ascii=False, indent=2)
    open(p,"a").write("\n")
    print(loc, "ok")
PY
python3 /tmp/add_tx_i18n.py
```

- [ ] **Step 2: Run the parity test**

Run: `npx vitest run src/i18n/messages.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 3: Commit**

```bash
git add messages/*.json
git commit -m "i18n(earn): add earn.tx copy (review/status/next) for all 7 locales"
```

---

### Task 6: Refactor `SupplyZestModal` onto `TxSheet`

**Files:**
- Modify (rewrite): `src/components/earn/SupplyZestModal.tsx`

**Interfaces:**
- Consumes: `useTxFlow`, `TxSheet`, `AmountField`, `ReviewRows` (Tasks 2–4); `earn.tx.*` keys (Task 5).

- [ ] **Step 1: Rewrite the modal**

Replace the entire body of `src/components/earn/SupplyZestModal.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bitcoin } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { supplyZestSbtc } from "@/lib/zest";
import {
  sbtcToSats, satsToSbtc, validateSupplyAmount, estimateZTokenReceived,
} from "@/lib/domain/zest/amount";
import TxSheet from "@/components/tx/TxSheet";
import AmountField from "@/components/tx/AmountField";
import ReviewRows from "@/components/tx/ReviewRows";
import { useTxFlow } from "@/components/tx/useTxFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  availableSbtc: number;
}

export default function SupplyZestModal({ open, onClose, availableSbtc }: Props) {
  const t = useTranslations("earn");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amount, setAmount] = useState("");

  const availableSats = sbtcToSats(availableSbtc);
  const amt = Number(amount);
  const amountSats = Number.isFinite(amt) && amt > 0 ? sbtcToSats(amt) : 0;
  const validation = validateSupplyAmount(amountSats, availableSats);
  const estZ = satsToSbtc(estimateZTokenReceived(amountSats));

  const tx = useTxFlow({
    driver: (onFinish, onCancel) => {
      if (!isConnected || !stxAddress) { onCancel(); return; }
      supplyZestSbtc(amountSats, stxAddress, onFinish, onCancel);
    },
    label: t("zest.supplyCta"),
    category: "wallet",
    context: { tokenSymbol: "sBTC", amount, action: "created" },
    address: stxAddress,
    submittedMessage: t("zest.submitted"),
    addNotification,
  });

  // Reset form + flow each time the modal opens.
  useEffect(() => { if (open) { setAmount(""); tx.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorText =
    amountSats === 0 ? null
    : validation.ok ? null
    : validation.reason === "below-min" ? t("zest.errBelowMin")
    : validation.reason === "insufficient" ? t("zest.errInsufficient")
    : t("zest.errZero");

  return (
    <TxSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      header={{ icon: Bitcoin, iconBg: "rgba(247, 147, 26, 0.14)", iconColor: "#F7931A", title: t("zest.supplyTitle") }}
      phase={tx.phase}
      txId={tx.txId}
      canSubmit={validation.ok}
      onSubmit={tx.submit}
      submitLabel={t("zest.supplyCta")}
      submittingLabel={t("tx.confirmInWallet")}
      statusCopy={{
        submitted: t("tx.submitted"), confirmed: t("tx.confirmed"),
        failed: t("tx.failed"), viewOnExplorer: t("tx.viewOnExplorer"),
      }}
      nextActions={[{ label: t("tx.nextEarn"), href: "/earn" }]}
      review={validation.ok && amountSats > 0 ? (
        <ReviewRows
          title={t("tx.reviewTitle")}
          rows={[
            [t("zest.supplyCta"), `${amount} sBTC`],
            [t("zest.receiveEst", { amount: estZ.toFixed(8) }), ""],
          ]}
        />
      ) : null}
    >
      <AmountField
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(String(availableSbtc))}
        maxLabel={t("zest.max")}
        label={t("zest.amountLabel")}
        balanceLabel={`${t("zest.available")}: ${availableSbtc.toFixed(8)} sBTC`}
        error={errorText}
        placeholder="0.00000000"
      />
    </TxSheet>
  );
}
```

- [ ] **Step 2: Lint + typecheck + build**

Run: `npx eslint src/components/earn/SupplyZestModal.tsx && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: build succeeds, no type/lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/earn/SupplyZestModal.tsx
git commit -m "refactor(earn): SupplyZestModal onto TxSheet"
```

---

### Task 7: Refactor `StakeStxModal` onto `TxSheet`

**Files:**
- Modify (rewrite): `src/components/earn/StakeStxModal.tsx`

**Interfaces:**
- Consumes: `useTxFlow`, `TxSheet`, `AmountField`, `ReviewRows`; `earn.tx.*` keys. Note this modal's own copy lives under the `assets.stake` namespace.

- [ ] **Step 1: Rewrite the modal**

Replace the entire body of `src/components/earn/StakeStxModal.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { stakeStx, fetchStxPerStStx } from "@/lib/stacking-dao";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";
import TxSheet from "@/components/tx/TxSheet";
import AmountField from "@/components/tx/AmountField";
import ReviewRows from "@/components/tx/ReviewRows";
import { useTxFlow } from "@/components/tx/useTxFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  availableStx: number;
  stStxStakedStx?: number;
}

export default function StakeStxModal({ open, onClose, availableStx, stStxStakedStx = 0 }: Props) {
  const t = useTranslations("assets.stake");
  const tx18 = useTranslations("earn.tx");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchStxPerStStx().then((r) => { if (active) setRate(r); });
    return () => { active = false; };
  }, [open]);

  const availableUstx = idleStx(stxToMicro(availableStx));
  const amt = Number(amount);
  const amountUstx = Number.isFinite(amt) && amt > 0 ? stxToMicro(amt) : 0;
  const validation = validateStakeAmount(amountUstx, availableUstx);
  const estStStx = rate ? microToSTX(estimateStStxReceived(amountUstx, rate)) : null;

  const tx = useTxFlow({
    driver: (onFinish, onCancel) => {
      if (!isConnected || !stxAddress) { addNotification(t("connectFirst"), "error", "wallet", 5000); onCancel(); return; }
      stakeStx(amountUstx, stxAddress, onFinish, onCancel);
    },
    label: t("txLabel"),
    category: "wallet",
    context: { tokenSymbol: "stSTX", amount, action: "created" },
    address: stxAddress,
    submittedMessage: t("submittedTitle"),
    addNotification,
  });

  useEffect(() => { if (open) { setAmount(""); tx.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorText =
    amountUstx === 0 ? null
    : validation.ok ? null
    : validation.reason === "below-min" ? t("minError", { min: MIN_STAKE_USTX / 1_000_000 })
    : t("balanceError");

  return (
    <TxSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      header={{ icon: Lock, iconBg: "var(--accent-dim)", iconColor: "var(--accent)", title: t("title"), subtitle: t("subtitle") }}
      phase={tx.phase}
      txId={tx.txId}
      canSubmit={validation.ok}
      onSubmit={tx.submit}
      submitLabel={t("submit")}
      submittingLabel={tx18("confirmInWallet")}
      statusCopy={{
        submitted: tx18("submitted"), confirmed: tx18("confirmed"),
        failed: tx18("failed"), viewOnExplorer: tx18("viewOnExplorer"),
      }}
      nextActions={[{ label: tx18("nextEarn"), href: "/earn" }]}
      review={validation.ok && amountUstx > 0 ? (
        <ReviewRows
          title={tx18("reviewTitle")}
          rows={[
            [t("submit"), `${amount} STX`],
            ...(estStStx !== null ? [[t("estReceive", { amount: estStStx.toFixed(2) }), ""] as [string, string]] : []),
          ]}
        />
      ) : null}
    >
      <AmountField
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(String(microToSTX(availableUstx)))}
        maxLabel={t("max")}
        label={t("amountLabel")}
        balanceLabel={t("balance", { balance: microToSTX(availableUstx).toFixed(2) })}
        error={errorText}
        placeholder="0.00"
      />
    </TxSheet>
  );
}
```

- [ ] **Step 2: Lint + typecheck + build**

Run: `npx eslint src/components/earn/StakeStxModal.tsx && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Run the earn e2e (must stay green)**

Run: `npx playwright test e2e/earn-stake.spec.ts --project=desktop-chromium`
Expected: 2 passed — the stacking row still opens the sheet and "Stake STX" is visible.

- [ ] **Step 4: Commit**

```bash
git add src/components/earn/StakeStxModal.tsx
git commit -m "refactor(earn): StakeStxModal onto TxSheet"
```

---

### Task 8: Refactor `WithdrawZestModal` onto `TxSheet`

**Files:**
- Read first: `src/components/earn/WithdrawZestModal.tsx` (to copy its exact domain calls, validation keys, and the `suppliedSbtc` prop).
- Modify (rewrite): `src/components/earn/WithdrawZestModal.tsx`

**Interfaces:**
- Consumes: same kit as Tasks 6–7. Mirror Task 6's structure but use the withdraw domain fn and `zest.withdrawCta` / withdraw validation copy already present in the file. Keep the existing `Props` (`open`, `onClose`, `suppliedSbtc`).

- [ ] **Step 1: Read the current file**

Run: open `src/components/earn/WithdrawZestModal.tsx` and note: the withdraw domain fn name, the validation helper (e.g. `validateWithdrawAmount`), the error keys (`zest.errExceeds` etc.), and the estimate. Reuse them verbatim.

- [ ] **Step 2: Rewrite using the TxSheet kit**

Mirror Task 6's `SupplyZestModal` shape exactly, with these substitutions:
- header icon stays `Bitcoin`, title `t("zest.withdrawTitle")`.
- driver calls the withdraw fn found in Step 1 with `(amountSats, stxAddress, onFinish, onCancel)`.
- `label`/`submitLabel`: `t("zest.withdrawCta")`; `submittedMessage`: `t("zest.submitted")`.
- balance line: `${t("zest.supplied")}: ${suppliedSbtc.toFixed(8)} sBTC`; `onMax` sets `String(suppliedSbtc)`.
- error mapping uses the withdraw reasons from Step 1 (include `validation.reason === "exceeds" ? t("zest.errExceeds")`).
- `context.action`: `"created"`.
- `nextActions`: `[{ label: t("tx.nextEarn"), href: "/earn" }]`.
- review rows: `[[t("zest.withdrawCta"), `${amount} sBTC`]]` plus the receive estimate if the file computes one.

- [ ] **Step 3: Lint + typecheck + build**

Run: `npx eslint src/components/earn/WithdrawZestModal.tsx && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/earn/WithdrawZestModal.tsx
git commit -m "refactor(earn): WithdrawZestModal onto TxSheet"
```

---

### Task 9: e2e structural assertion + final gate

**Files:**
- Modify: `e2e/earn-stake.spec.ts`

**Interfaces:**
- Consumes: the refactored `StakeStxModal` (Task 7). The mock wallet fixture does NOT stub `openContractCall`, so the test asserts the rendered sheet structure (AmountField + Max), not a signed submit.

- [ ] **Step 1: Add the assertion to the existing test**

In `e2e/earn-stake.spec.ts`, inside the `"stacking row opens the in-app stake modal"` test, after the existing `await expect(page.getByText("Stake STX").first()).toBeVisible();` line, append:

```ts
    // The sheet renders the shared AmountField (input + Max).
    await expect(page.getByRole("textbox").first()).toBeVisible();
    await expect(page.getByText(/^Max$/i).first()).toBeVisible();
```

- [ ] **Step 2: Run the earn e2e (both desktop + mobile)**

Run: `npx playwright test e2e/earn-stake.spec.ts`
Expected: all pass across desktop + mobile profiles (verifies the responsive bottom-sheet renders on mobile too).

- [ ] **Step 3: Full regression gate**

Run: `npx vitest run && npm run build`
Expected: all unit tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add e2e/earn-stake.spec.ts
git commit -m "test(earn): assert TxSheet renders AmountField in stake flow"
```

---

## Self-Review

**Spec coverage:**
- TxSheet shell + responsive + tokens → Task 4. ✓
- useTxFlow state machine + onResolved upgrade → Tasks 1, 2. ✓
- AmountField + ReviewRows → Tasks 3, 4. ✓
- Inline review → Tasks 6–8 (`review` slot). ✓
- 3 Earn modals refactored → Tasks 6, 7, 8. ✓
- trackTx additive callback → Task 1. ✓
- i18n `earn.tx` 7 locales → Task 5. ✓
- Testing: useTxFlow unit (Task 2), earn e2e stays green + extra assert (Tasks 7, 9). ✓
- Non-goals respected: no Swap/DCA, no sheet.tsx/dialog.tsx change, no polling change. ✓

**Type consistency:** `txReducer`/`useTxFlow` signatures, `TxPhase`, `NextAction`, `UseTxFlowOptions.submittedMessage`, `TxSheet` props (`submittingLabel`, `statusCopy`, `canSubmit`) are defined in Tasks 2/4 and consumed identically in Tasks 6–8. `trackTx.onResolved` defined Task 1, consumed Task 2.

**Notes for the implementer:**
- The submitted-toast wording is passed per call-site via `submittedMessage` to preserve existing copy (`zest.submitted` / `assets.stake.submittedTitle`).
- Each modal's `useEffect` reset disables `react-hooks/exhaustive-deps` on purpose (open-triggered reset), matching the original files.
- `var(--negative)` is the themed error color (replaces the old hardcoded `#ef4444`).
