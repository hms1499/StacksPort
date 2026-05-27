# Drawer Alert Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Alert" action button's navigation-to-/notifications behavior with an inline popover that lets the user create, list, and delete price alerts without leaving the asset drawer.

**Architecture:** One new component `src/components/assets/drawer/AlertPopover.tsx` + targeted edits to the drawer shell `src/components/assets/drawer/index.tsx`. Reads/writes via existing `usePriceAlertStore` and `usePushNotifications`. No backend, store, or keeper-bot changes.

**Tech Stack:** React 19, Next.js 15 App Router, TypeScript, Tailwind, Zustand (existing `priceAlertStore`), `usePushNotifications` (existing), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-05-27-drawer-alert-popover-design.md`

---

## Commit granularity

Each task below maps to one commit by default, but the implementer SHOULD split a task into multiple commits when the task touches more than one logical concern and each sub-commit can stay buildable. User preference: fine-grained, RED/GREEN style, helper-vs-wiring separated, each commit still green.

Concrete suggestion for Task 2 (the largest): split into **2 commits** —
- 2a: create `AlertPopover.tsx` + wire shell toggle + render popover (alert button always enabled, no `isAlertSupported` guard yet)
- 2b: add `isAlertSupported` computation + `disabled`/`title` props on the Alert button + guard the popover render

Task 6 can similarly split: focus management commit, then ARIA-attrs commit. Use judgment per task — don't split for the sake of splitting if the changes are tightly coupled (e.g. Task 1's `ActionButton` extension is one cohesive change and stays as one commit).

---

## Reference: current state

### `src/components/assets/drawer/index.tsx` (the shell)

- Line 5 — lucide imports include `Bell` (already used by Alert button).
- Lines 85-88 — current `onAlert` handler:

  ```ts
  const onAlert = () => {
    router.push(`/notifications?token=${encodeURIComponent(token.symbol)}`);
    onClose();
  };
  ```

- Line 231 — Alert button render: `<ActionButton icon={<Bell size={16} />} label="Alert" onClick={onAlert} />`
- Lines 284-307 — `ActionButton` local component:

  ```tsx
  function ActionButton({
    icon,
    label,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
        style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
      >
        {icon}
        <span className="text-[11px] font-semibold">{label}</span>
      </button>
    );
  }
  ```

### `src/store/priceAlertStore.ts`

- Exports `usePriceAlertStore` (Zustand hook).
- Selectors: `alerts: PriceAlert[]`.
- Actions: `addAlert(tokenSymbol, geckoId, condition, targetPrice)`, `removeAlert(id)`.
- `addAlert` returns `void` (does not return the new id).

### `src/types/priceAlerts.ts`

```ts
export type PriceAlertCondition = 'above' | 'below';
export interface PriceAlert {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: PriceAlertCondition;
  targetPrice: number;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
}
export const PRICE_ALERT_TOKENS: { symbol: string; geckoId: string; name: string }[] = [
  { symbol: 'STX',    geckoId: 'blockstack',     name: 'Stacks' },
  { symbol: 'BTC',    geckoId: 'bitcoin',        name: 'Bitcoin' },
  { symbol: 'WELSH',  geckoId: 'welshcorgicoin', name: 'Welsh Corgi' },
  { symbol: 'ALEX',   geckoId: 'alexgo',         name: 'ALEX' },
  { symbol: 'VELAR',  geckoId: 'velar',          name: 'Velar' },
  { symbol: 'stSTX',  geckoId: 'staked-stx',     name: 'Staked STX' },
];
```

### `src/hooks/usePushNotifications.ts`

Provides at minimum: `{ permission: 'default' | 'granted' | 'denied'; isSupported: boolean; subscribe(): Promise<void> }`.

### `src/components/price-alerts/PriceAlertForm.tsx`

Reference implementation for the full-page form (see lines 1-168). Use as a behavioral reference for validation rules and copy.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/components/assets/drawer/AlertPopover.tsx` | CREATE | Popover UI: form, suggestion chips, existing-alerts list, push prompt, dismiss handlers, focus management |
| `src/components/assets/drawer/index.tsx` | MODIFY | Extend `ActionButton` for ref+disabled+title; replace `onAlert` with toggle; render `AlertPopover` |
| `e2e/drawer-alert-popover.spec.ts` | CREATE | E2E: open drawer → create alert via chip → assert list → ESC closes popover not drawer |
| `e2e/drawer-alert-disabled.spec.ts` | CREATE | E2E: drawer for non-whitelist token → Alert button disabled with title |

---

## Task 1: Extend ActionButton (ref + disabled + title)

This is a preparatory refactor. `ActionButton` (defined inside `drawer/index.tsx`) needs to:
- Forward a ref so the popover can anchor / restore focus to the button.
- Accept `disabled` and `title` props for the non-whitelist tooltip case.

The four current call sites (Swap, Send, Receive, Alert) do not pass these props — defaults must preserve current behavior.

**Files:**
- Modify: `src/components/assets/drawer/index.tsx` (lines 284-307, the `ActionButton` component)

- [ ] **Step 1: Update the import for React in the shell**

The shell already imports React features it uses. Confirm `forwardRef` is added. Open `src/components/assets/drawer/index.tsx` line 1-30 and ensure the React import includes `forwardRef`:

```tsx
// At top of file, before the lucide imports:
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
```

If `useRef` is not already imported, add it. If `forwardRef` is not already imported, add it.

- [ ] **Step 2: Rewrite the `ActionButton` component**

Replace lines 284-307 (`function ActionButton({...}) {...}`) with:

```tsx
const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  }
>(function ActionButton({ icon, label, onClick, disabled, title }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
      onMouseEnter={(e) => {
        if (!(e.currentTarget as HTMLButtonElement).disabled) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)";
        }
      }}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
});
```

Key changes:
- `forwardRef<HTMLButtonElement, Props>(function ActionButton(...) { ... })`
- New optional props: `disabled?: boolean`, `title?: string`.
- `<button>` receives `ref`, `disabled`, `title`.
- Tailwind classes get `disabled:opacity-40 disabled:cursor-not-allowed`.
- Hover handler skips when disabled (prevents stuck hover bg on a button that can't be clicked).

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

Both must pass. The four existing call sites (Swap/Send/Receive/Alert) don't pass the new props — TypeScript should accept them as optional.

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/index.tsx
git commit -m "refactor(drawer): forward ref + accept disabled/title on ActionButton"
```

NO `Co-Authored-By` trailer.

---

## Task 2: Scaffold AlertPopover + wire shell toggle + disabled state

Ships the MVP slice: user can open the popover, see a basic form, create an alert, and close the popover. Non-whitelist tokens show the Alert button greyed out with a tooltip.

The popover at this stage has: condition radios, target-price input, live summary, Create button, and a × close button. NO existing-alerts list, NO suggestion chips, NO push prompt — those come in later tasks.

**Files:**
- Create: `src/components/assets/drawer/AlertPopover.tsx`
- Modify: `src/components/assets/drawer/index.tsx` (imports, state, ref, ActionButton call site, popover render)

- [ ] **Step 1: Create `src/components/assets/drawer/AlertPopover.tsx`**

Write the file with the following exact content:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { PRICE_ALERT_TOKENS, type PriceAlertCondition } from "@/types/priceAlerts";
import type { TokenWithValue } from "@/lib/stacks";

interface Props {
  token: TokenWithValue;
  currentPrice: number;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function AlertPopover({ token, currentPrice, open, onClose, anchorRef }: Props) {
  const addAlert = usePriceAlertStore((s) => s.addAlert);

  const [condition, setCondition] = useState<PriceAlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState("");

  const geckoId = PRICE_ALERT_TOKENS.find((t) => t.symbol === token.symbol)?.geckoId;

  // ESC closes popover only (not the drawer). Capture phase + stopPropagation
  // so the shell's window-level ESC listener does not also fire.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  // Click outside the popover and the anchor button → close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const popover = document.getElementById("alert-popover-root");
      if (popover?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose, anchorRef]);

  if (!open || !geckoId) return null;

  const parsed = parseFloat(targetPrice);
  const isValid = !isNaN(parsed) && parsed > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError("Please enter a valid price greater than 0");
      return;
    }
    setError("");
    addAlert(token.symbol, geckoId, condition, parsed);
    setTargetPrice("");
  };

  return (
    <div
      id="alert-popover-root"
      role="dialog"
      aria-modal="false"
      aria-labelledby="alert-popover-title"
      className="absolute right-4 bottom-24 z-50 w-[calc(100%-32px)] sm:w-80 rounded-2xl shadow-2xl border p-4"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          id="alert-popover-title"
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Set price alert — {token.symbol}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close price alert"
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Current: ${currentPrice.toLocaleString()}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCondition("above")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              condition === "above"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-transparent hover:bg-gray-50"
            }`}
            style={condition !== "above" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingUp size={14} /> Above
          </button>
          <button
            type="button"
            onClick={() => setCondition("below")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              condition === "below"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-transparent hover:bg-gray-50"
            }`}
            style={condition !== "below" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingDown size={14} /> Below
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Target Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>$</span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value);
                if (error) setError("");
              }}
              className="w-full pl-6 pr-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        {isValid && (
          <div className="text-xs px-2.5 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            Alert when <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{token.symbol}</span>{" "}
            {condition === "above" ? "rises above" : "drops below"}{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              ${parsed.toLocaleString()}
            </span>
          </div>
        )}

        <button
          type="submit"
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-white"
          style={{ backgroundColor: "#408A71" }}
        >
          Create alert
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Update the shell to wire popover + disabled state**

Edit `src/components/assets/drawer/index.tsx`:

(a) Add imports at the top (alongside existing imports):

```tsx
import AlertPopover from "./AlertPopover";
import { PRICE_ALERT_TOKENS } from "@/types/priceAlerts";
```

(b) Replace the existing `onAlert` handler (around lines 85-88). Find:

```ts
const onAlert = () => {
  router.push(`/notifications?token=${encodeURIComponent(token.symbol)}`);
  onClose();
};
```

Replace with:

```ts
const isAlertSupported = PRICE_ALERT_TOKENS.some((t) => t.symbol === token.symbol);
const [alertOpen, setAlertOpen] = useState(false);
const alertBtnRef = useRef<HTMLButtonElement>(null);

const onAlert = () => {
  if (!isAlertSupported) return;
  setAlertOpen((o) => !o);
};
```

`useState` and `useRef` should already be imported from React after Task 1. If not, add them.

(c) Update the Alert `ActionButton` render (around line 231). Find:

```tsx
<ActionButton icon={<Bell size={16} />} label="Alert" onClick={onAlert} />
```

Replace with:

```tsx
<ActionButton
  ref={alertBtnRef}
  icon={<Bell size={16} />}
  label="Alert"
  onClick={onAlert}
  disabled={!isAlertSupported}
  title={!isAlertSupported ? "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX" : undefined}
/>
```

(d) Render the popover just before the closing `</div>` of the drawer sheet container (the inner `div` with `w-full sm:max-w-md ml-auto`). Find the location near the bottom of the JSX (around line 277, after the `Meta` block's closing `</div>` but before the sheet's closing `</div>`):

```tsx
{isAlertSupported && (
  <AlertPopover
    token={token}
    currentPrice={token.priceUsd}
    open={alertOpen}
    onClose={() => setAlertOpen(false)}
    anchorRef={alertBtnRef}
  />
)}
```

Place it as a sibling of the existing JSX blocks inside the sheet container so it's positioned relative to the drawer.

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

Both must pass.

- [ ] **Step 4: Smoke test the MVP flow manually**

```bash
npm run dev
```

Visit `http://localhost:3000/assets`, connect wallet, open the STX detail drawer.

Verify:
- Alert button is enabled, has `Bell` icon and "Alert" label.
- Click Alert → popover appears in the bottom-right of the drawer.
- Enter `1.50` in the target price input → summary line appears.
- Click Create → input clears; popover stays open.
- Click ×, click outside the popover, or press ESC → popover closes; drawer stays open.

Then open the drawer for a non-whitelist token (e.g. open holdings panel and click any token not in PRICE_ALERT_TOKENS — `sBTC`, `aeUSDC`, etc.):
- Alert button is greyed out.
- Hover shows the tooltip text.
- Click does nothing.

Kill the dev server:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/drawer/AlertPopover.tsx src/components/assets/drawer/index.tsx
git commit -m "feat(drawer): inline price-alert popover with disabled state for non-whitelist tokens"
```

NO `Co-Authored-By` trailer.

---

## Task 3: Existing-alerts list with delete

Adds a list above the form showing all alerts for the current token. Each row has a delete (×) button.

**Files:**
- Modify: `src/components/assets/drawer/AlertPopover.tsx`

- [ ] **Step 1: Add list rendering between the "Current" line and the form**

In `AlertPopover.tsx`, add a `removeAlert` selector and a derived `existingAlerts` array near the top of the component (after the `addAlert` line):

```tsx
const addAlert = usePriceAlertStore((s) => s.addAlert);
const removeAlert = usePriceAlertStore((s) => s.removeAlert);
const existingAlerts = usePriceAlertStore((s) =>
  s.alerts.filter((a) => a.tokenSymbol === token.symbol)
);
```

Also add `TrendingUp`, `TrendingDown` are already imported. Add `X` is already imported (used for the close button).

- [ ] **Step 2: Render the list between the "Current:" line and the `<form>`**

Find the existing `<p className="text-xs mb-3" ...>Current: ${currentPrice.toLocaleString()}</p>` block. Immediately after it, before the `<form>`, add:

```tsx
{existingAlerts.length > 0 && (
  <div className="mb-3 space-y-1.5">
    <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
      Existing alerts ({existingAlerts.length})
    </p>
    {existingAlerts.map((a) => (
      <div
        key={a.id}
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {a.condition === "above" ? (
            <TrendingUp size={12} className="text-green-500" />
          ) : (
            <TrendingDown size={12} className="text-red-500" />
          )}
          {a.condition === "above" ? "Above" : "Below"} ${a.targetPrice.toLocaleString()}
          <span
            className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${
              a.isActive
                ? "bg-green-500/10 text-green-600"
                : "bg-gray-500/10 text-gray-500"
            }`}
          >
            {a.isActive ? "Active" : "Triggered"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => removeAlert(a.id)}
          aria-label={`Delete ${a.condition} $${a.targetPrice} alert`}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
        >
          <X size={12} />
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

- Open STX drawer, click Alert.
- Create an alert at $1.50.
- The new alert appears in the existing-alerts list with the right condition/price/Active badge.
- Click the × on the row → the row disappears.
- Create two alerts → both appear in the list.

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/drawer/AlertPopover.tsx
git commit -m "feat(drawer): list existing alerts in popover with delete action"
```

---

## Task 4: Suggestion chips (+5% / -5%)

Adds two clickable chips that pre-fill the form with a price 5% above or below the current price. Chip also sets the condition automatically.

**Files:**
- Modify: `src/components/assets/drawer/AlertPopover.tsx`

- [ ] **Step 1: Add chip rendering before the condition radios**

In `AlertPopover.tsx`, find the `<form onSubmit={handleSubmit} className="space-y-3">` block. Immediately inside the form (before the `<div className="grid grid-cols-2 gap-2">` with the condition radios), insert:

```tsx
{currentPrice > 0 && (
  <div className="flex items-center gap-2 mb-1">
    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Quick:</span>
    <button
      type="button"
      onClick={() => {
        setTargetPrice((currentPrice * 1.05).toFixed(currentPrice >= 1 ? 2 : 6));
        setCondition("above");
        if (error) setError("");
      }}
      className="px-2 py-1 rounded-md text-[11px] font-medium border transition-colors hover:bg-green-50"
      style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
    >
      +5% ${(currentPrice * 1.05).toFixed(currentPrice >= 1 ? 2 : 6)}
    </button>
    <button
      type="button"
      onClick={() => {
        setTargetPrice((currentPrice * 0.95).toFixed(currentPrice >= 1 ? 2 : 6));
        setCondition("below");
        if (error) setError("");
      }}
      className="px-2 py-1 rounded-md text-[11px] font-medium border transition-colors hover:bg-red-50"
      style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
    >
      -5% ${(currentPrice * 0.95).toFixed(currentPrice >= 1 ? 2 : 6)}
    </button>
  </div>
)}
```

Rationale for the precision: tokens with `currentPrice >= 1` (STX, BTC) get 2 decimals; sub-dollar tokens (WELSH at $0.0004 etc.) get 6 decimals so the chip price isn't `$0.00`.

- [ ] **Step 2: Verify build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

- Open STX drawer, click Alert.
- Two chips visible with formatted prices.
- Click `+5% $X.XX` → input fills with that price; condition switches to Above.
- Click `-5% $X.XX` → input updates; condition switches to Below.
- Submit → alert created with the chip value.
- Open drawer for a sub-dollar token in the whitelist (WELSH if held) → chip shows 6-decimal price.

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/AlertPopover.tsx
git commit -m "feat(drawer): +5%/-5% suggestion chips in alert popover"
```

---

## Task 5: Push-notification prompt

Adds a session-dismissable banner inside the popover that nudges the user to enable push notifications if they have any alerts but haven't granted permission yet. Without push, alerts fire silently into the void — this is the bridge.

**Files:**
- Modify: `src/components/assets/drawer/AlertPopover.tsx`

- [ ] **Step 1: Add push hook + dismiss state**

In `AlertPopover.tsx`, add the import at the top:

```tsx
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell } from "lucide-react";
```

(`Bell` is added to the lucide imports — `X`, `TrendingUp`, `TrendingDown` are already there.)

Inside the component, after the other `useState` calls, add:

```tsx
const { permission, isSupported, subscribe } = usePushNotifications();
const totalAlerts = usePriceAlertStore((s) => s.alerts.length);
const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
const [subscribing, setSubscribing] = useState(false);

const showPushPrompt =
  !pushPromptDismissed && isSupported && permission !== "granted" && totalAlerts >= 1;

const handleEnablePush = async () => {
  setSubscribing(true);
  try {
    await subscribe();
  } finally {
    setSubscribing(false);
    setPushPromptDismissed(true);
  }
};
```

- [ ] **Step 2: Render the prompt at the bottom of the popover**

After the closing `</form>` tag (still inside the popover root `<div>`), add:

```tsx
{showPushPrompt && (
  <div
    className="mt-3 pt-3 border-t flex items-start gap-2"
    style={{ borderColor: "var(--border-subtle)" }}
  >
    <Bell size={14} className="mt-0.5 shrink-0" style={{ color: "#408A71" }} />
    <div className="flex-1 min-w-0">
      <p className="text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
        Bật thông báo để nhận alert ngay cả khi đóng app
      </p>
      <div className="flex gap-2 mt-1.5">
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={subscribing}
          className="text-[11px] font-medium disabled:opacity-50"
          style={{ color: "#408A71" }}
        >
          {subscribing ? "Đang bật..." : "Bật"}
        </button>
        <button
          type="button"
          onClick={() => setPushPromptDismissed(true)}
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          Bỏ qua
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Use a browser profile where notification permission for `localhost:3000` is NOT granted (use an incognito window or clear site permissions).

- Open STX drawer, click Alert. If you have ≥1 alert anywhere, prompt should appear at the bottom of the popover.
- If you have 0 alerts: create one, prompt appears.
- Click `Bỏ qua` → prompt hides; reopening popover in same session does not re-show it.
- Reload page → prompt should reappear (session-scoped dismiss, not persisted).
- Click `Bật` → browser permission dialog appears. Grant → prompt hides; reopening popover does not re-show it (now `permission === 'granted'`).

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/drawer/AlertPopover.tsx
git commit -m "feat(drawer): one-time push enable prompt inside alert popover"
```

---

## Task 6: Focus management + ARIA polish

Improves keyboard/screen-reader behavior. When the popover opens, focus moves into it; when it closes, focus returns to the Alert button. The Alert button gets `aria-expanded` and `aria-haspopup`.

**Files:**
- Modify: `src/components/assets/drawer/AlertPopover.tsx`
- Modify: `src/components/assets/drawer/index.tsx` (Alert ActionButton call site)

- [ ] **Step 1: Add focus management in AlertPopover**

At the top of `AlertPopover.tsx`, ensure `useRef` is imported:

```tsx
import { useEffect, useRef, useState } from "react";
```

Inside the component, add a ref for the first focusable element and an effect to manage focus:

```tsx
const firstFocusRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (open) {
    // Focus the target-price input when the popover opens. Slight delay to
    // wait for the DOM to settle.
    const t = setTimeout(() => firstFocusRef.current?.focus(), 50);
    return () => clearTimeout(t);
  } else {
    // Return focus to the Alert button after the popover closes.
    anchorRef.current?.focus();
  }
}, [open, anchorRef]);
```

Attach `ref={firstFocusRef}` to the target-price `<input>` element:

```tsx
<input
  ref={firstFocusRef}
  type="number"
  step="any"
  // ... rest unchanged
/>
```

- [ ] **Step 2: Add ARIA attributes to the Alert ActionButton in the shell**

In `src/components/assets/drawer/index.tsx`, update the Alert `ActionButton` call site. Currently:

```tsx
<ActionButton
  ref={alertBtnRef}
  icon={<Bell size={16} />}
  label="Alert"
  onClick={onAlert}
  disabled={!isAlertSupported}
  title={!isAlertSupported ? "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX" : undefined}
/>
```

ActionButton's signature does not currently forward arbitrary HTML attributes. The simplest fix: extend `ActionButton`'s props to also accept `ariaExpanded` and `ariaHasPopup`, and forward them.

In the `ActionButton` definition (in the same file), extend the props and forward:

```tsx
const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    ariaExpanded?: boolean;
    ariaHasPopup?: "dialog" | "menu" | "listbox" | "tree" | "grid" | "true";
  }
>(function ActionButton({ icon, label, onClick, disabled, title, ariaExpanded, ariaHasPopup }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
      onMouseEnter={(e) => {
        if (!(e.currentTarget as HTMLButtonElement).disabled) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)";
        }
      }}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
});
```

Then update the Alert call site:

```tsx
<ActionButton
  ref={alertBtnRef}
  icon={<Bell size={16} />}
  label="Alert"
  onClick={onAlert}
  disabled={!isAlertSupported}
  title={!isAlertSupported ? "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX" : undefined}
  ariaExpanded={isAlertSupported ? alertOpen : undefined}
  ariaHasPopup={isAlertSupported ? "dialog" : undefined}
/>
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

- Open STX drawer. Tab to the Alert button (use keyboard only). Press Enter or Space → popover opens, focus jumps to the target-price input.
- Tab through the popover: chips → condition radios → input → Create → existing alert × buttons → close button.
- Press ESC → popover closes; focus returns to the Alert button.
- With a screen reader (VoiceOver `cmd+f5` on macOS), the Alert button announces "expanded" / "collapsed" state.

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/drawer/AlertPopover.tsx src/components/assets/drawer/index.tsx
git commit -m "feat(drawer): focus management + aria-expanded on alert popover"
```

---

## Task 7: E2E tests

Two Playwright specs to cover the happy path and the disabled-state branch. These give CI a regression net for the next time anyone touches the drawer.

**Files:**
- Create: `e2e/drawer-alert-popover.spec.ts`
- Create: `e2e/drawer-alert-disabled.spec.ts`

The existing `e2e/fixtures/test-utils.ts` provides a `connectMockWallet(page)` helper. Read it briefly to confirm the helper's name and signature before writing the tests — the snippets below assume `connectMockWallet`.

- [ ] **Step 1: Confirm e2e fixture helpers**

```bash
grep -n "export\|connectMockWallet\|mockWallet" e2e/fixtures/test-utils.ts
```

If the helper has a different name (e.g. `mockWalletConnect`), substitute that name in the test files below.

- [ ] **Step 2: Create `e2e/drawer-alert-popover.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { connectMockWallet } from "./fixtures/test-utils";

test.describe("Drawer alert popover", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try { window.localStorage.clear(); } catch { /* ignore */ }
    });
  });

  test("create alert via chip, see it in list, ESC closes popover not drawer", async ({ page }) => {
    await page.goto("/assets");
    await connectMockWallet(page);

    // Open the holdings panel and click the STX row.
    await page.getByRole("tab", { name: "Holdings" }).click();
    await page.getByRole("button", { name: /^STX/ }).first().click();

    // Drawer is open with the Alert action button.
    const alertBtn = page.getByRole("button", { name: "Alert" });
    await expect(alertBtn).toBeVisible();
    await expect(alertBtn).toBeEnabled();

    await alertBtn.click();

    // Popover is open.
    const popover = page.getByRole("dialog", { name: /Set price alert/ });
    await expect(popover).toBeVisible();

    // Click the +5% chip.
    await popover.getByRole("button", { name: /^\+5%/ }).click();

    // Create.
    await popover.getByRole("button", { name: "Create alert" }).click();

    // Existing-alerts list shows the new entry.
    await expect(popover.getByText(/Existing alerts \(1\)/)).toBeVisible();
    await expect(popover.getByText(/Above \$/)).toBeVisible();

    // ESC closes only the popover.
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();

    // The drawer is still open (the Alert button is still visible).
    await expect(alertBtn).toBeVisible();
  });
});
```

- [ ] **Step 3: Create `e2e/drawer-alert-disabled.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { connectMockWallet } from "./fixtures/test-utils";

test.describe("Drawer alert disabled state", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try { window.localStorage.clear(); } catch { /* ignore */ }
    });
  });

  test("non-whitelist token shows disabled Alert button with tooltip", async ({ page }) => {
    await page.goto("/assets");
    await connectMockWallet(page);

    await page.getByRole("tab", { name: "Holdings" }).click();

    // Find a token row that is NOT in the whitelist (STX, BTC, WELSH, ALEX, VELAR, stSTX).
    // The mock wallet fixture seeds a portfolio that includes at least one such token
    // (commonly sBTC or aeUSDC). Pick the first non-whitelist row available.
    const nonWhitelistSymbols = ["sBTC", "aeUSDC", "USDA", "DIKO", "xBTC"];
    let opened = false;
    for (const sym of nonWhitelistSymbols) {
      const row = page.getByRole("button", { name: new RegExp(`^${sym}`) }).first();
      if (await row.count()) {
        await row.click();
        opened = true;
        break;
      }
    }
    test.skip(!opened, "No non-whitelist token in mock portfolio — extend fixture to seed one");

    const alertBtn = page.getByRole("button", { name: "Alert" });
    await expect(alertBtn).toBeVisible();
    await expect(alertBtn).toBeDisabled();
    await expect(alertBtn).toHaveAttribute(
      "title",
      "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX"
    );

    // Clicking does not open a popover.
    await alertBtn.click({ force: true });
    await expect(page.getByRole("dialog", { name: /Set price alert/ })).toBeHidden();
  });
});
```

The `test.skip()` line keeps the test honest if the mock fixture doesn't currently seed any non-whitelist holdings — a hard failure there would be misleading. If skip fires, follow up by extending `e2e/fixtures/test-utils.ts` to include at least one non-whitelist token in the mock portfolio (out of scope for this plan).

- [ ] **Step 4: Run only these two specs**

```bash
npx playwright test e2e/drawer-alert-popover.spec.ts e2e/drawer-alert-disabled.spec.ts --project=chromium
```

Expected: both pass (or `drawer-alert-disabled` reports `skipped` with the message about extending the fixture — that's acceptable for v1).

If a selector misses (e.g. holdings row name regex doesn't match the actual DOM), iterate on the selector before commit.

- [ ] **Step 5: Commit**

```bash
git add e2e/drawer-alert-popover.spec.ts e2e/drawer-alert-disabled.spec.ts
git commit -m "test(e2e): drawer alert popover happy path + disabled state"
```

---

## Final verification

After Task 7:

- [ ] `git log --oneline -10` shows the 7 feature commits (Tasks 1-7).
- [ ] `npm run build && npm run lint` passes from a clean state.
- [ ] Manual flow once more on a real wallet connection — create alert for STX, delete it, verify it survives a page reload (Zustand persist), then verify the keeper bot picks it up (out-of-scope here, but listed for awareness).
- [ ] `lsof -ti:3000 | xargs kill -9 2>/dev/null || true` to free the port.

---

## Risk recap (from spec)

- **ESC bubbles to drawer:** mitigated by Task 2 Step 1 with `{ capture: true }` + `e.stopPropagation()`.
- **Click outside re-triggers on the anchor:** mitigated by Task 2 Step 1 with `anchorRef.current?.contains(target)` skip.
- **Mobile positioning:** mitigated by Task 2 Step 1 with `w-[calc(100%-32px)] sm:w-80` and bottom-right absolute positioning.
- **No new alert id returned by store:** acknowledged; focus stays on the cleared input rather than the new row.
