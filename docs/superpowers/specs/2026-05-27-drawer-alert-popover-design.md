# Drawer Alert Popover — Design

**Date:** 2026-05-27
**Status:** Approved, awaiting plan
**Type:** Feature (UX improvement on existing `priceAlertStore`)

## Problem

Today the "Alert" action button inside `src/components/assets/drawer/index.tsx` (the asset detail drawer) routes the user away from the drawer to `/notifications?token=<symbol>`. The user loses drawer context, lands on a separate page, and has to set up the alert from scratch even though the drawer already knows the token, current price, and any existing alerts.

For a portfolio-tracker primary user (DCA), setting price alerts close to entry/exit prices should be a one-click flow from the holdings drawer, not a page navigation.

## Goals

1. Replace the navigation with an inline popover anchored to the Alert button.
2. Reduce alert creation to ~3 clicks for common cases (open drawer → click +5%/-5% chip → click Create).
3. Surface existing alerts for the same token to prevent duplicates and allow quick deletion.
4. Validate that the new modular drawer architecture (just refactored in `drawer/*.tsx`) pays off — this is the first feature built on it.

## Non-Goals

- Editing existing alerts in-place (delete + recreate is fine).
- Modifying the `PRICE_ALERT_TOKENS` whitelist or the keeper-bot price-push logic.
- Adding new alert channels (email, Telegram).
- Replacing `/notifications` as the canonical full-management UI.
- Token coverage expansion: tokens outside `PRICE_ALERT_TOKENS` show a disabled Alert button with explanatory tooltip — no dynamic registry growth.

## User Flow

1. User opens the asset drawer for STX.
2. Clicks the "Alert" button in the action bar.
3. Popover opens anchored above the button. Shows current price ($1.42), any existing alerts for STX, two quick-pick chips (`+5% $1.49`, `-5% $1.35`), and a manual form (condition + target price + summary line + Create button).
4. User clicks `+5% $1.49` chip → input fills with `1.49`, condition auto-sets to `above`.
5. User clicks Create → alert is added to the store. Form resets. Existing-alerts list updates with the new entry.
6. If this is the user's first alert ever AND push permission is not granted AND push is supported, a one-line push prompt appears at the bottom of the popover with `[Bật]` and `[Bỏ qua]` buttons.
7. User closes popover (× button, click outside, or ESC). Drawer stays open.

For tokens not in `PRICE_ALERT_TOKENS` (e.g. aeUSDC, sBTC, USDA, arkadiko-token): the Alert button is rendered disabled with `title="Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX"`. No popover.

## Architecture

One new component plus targeted edits to the drawer shell. No store changes, no API changes, no keeper-bot changes.

```
src/components/assets/drawer/
├── index.tsx                # MODIFIED: replace router.push with popover toggle
├── AlertPopover.tsx         # NEW: popover + form + existing-alerts list
└── ... (existing 7 panel files unchanged)
```

The popover reads from `usePriceAlertStore` (same hook the `/notifications` page uses) and writes via `addAlert` / `removeAlert`. It reads push permission state from `usePushNotifications`.

## Component Spec

```ts
// src/components/assets/drawer/AlertPopover.tsx
interface Props {
  token: TokenWithValue;
  currentPrice: number;   // shell passes token.priceUsd
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;  // for outside-click + positioning
}

export default function AlertPopover(props: Props): JSX.Element | null;
```

Returns `null` when `!open`. When open, renders an absolutely-positioned `div` anchored above the Alert button on desktop, and as a right-aligned dropdown on mobile (drawer is full-width on mobile).

### Local state inside AlertPopover

| State | Type | Purpose |
|---|---|---|
| `condition` | `'above' \| 'below'` | Selected condition. Default `'above'`. |
| `targetPrice` | `string` | Input value (kept as string for input control). |
| `error` | `string` | Empty when valid. |
| `subscribing` | `boolean` | Push subscribe in-flight. |
| `pushPromptDismissed` | `boolean` | True once user clicks `Bỏ qua` or `Bật`. Session-scoped (not persisted). |

### Derived state

- `existingAlerts = useStore(s => s.alerts.filter(a => a.tokenSymbol === token.symbol))`
- `geckoIdForThisToken = PRICE_ALERT_TOKENS.find(t => t.symbol === token.symbol)?.geckoId` (component must not render unless `geckoIdForThisToken` exists; shell guards via `isAlertSupported`)
- `suggestUp = currentPrice * 1.05`
- `suggestDown = currentPrice * 0.95`
- `totalAlerts = useStore(s => s.alerts.length)` — global count across all tokens
- `showPushPrompt = !pushPromptDismissed && permission !== 'granted' && isSupported && totalAlerts >= 1`

The push prompt is shown whenever the user has at least one alert anywhere AND push isn't enabled AND they haven't dismissed it this session — not just "right after first alert creation". An alert without push notifications is useless, so we keep gently nudging until they enable it (or dismiss for the session).

### Layout (visual reference)

```
┌─ Set price alert — STX ──────────── [×] ┐
│ Current: $1.42                          │
│                                         │
│ Existing alerts (2):                    │  ← only renders if existingAlerts.length > 0
│  ↑ Above $1.60  Active  [×]            │
│  ↓ Below $1.20  Active  [×]            │
│                                         │
│ Quick:  [+5% $1.49] [-5% $1.35]        │
│                                         │
│ ○ Above  ● Below                        │
│ Target: [$________]                     │
│ → Alert when STX drops below $X         │  ← live summary, only when input is valid
│                                         │
│ [    Create alert    ]                  │
│ ─────────────────────────────────       │  ← only when showPushPrompt
│ 🔔 Bật thông báo để nhận alert ngay     │
│    cả khi đóng app                      │
│    [Bật]  [Bỏ qua]                      │
└─────────────────────────────────────────┘
```

Styling follows existing drawer Tailwind tokens (`var(--bg-card)`, `var(--border-subtle)`, `var(--text-primary)`, etc.). Width: 320px desktop, full drawer width minus 16px on mobile (`max-w-[calc(100%-32px)]`).

## Shell Integration

In `src/components/assets/drawer/index.tsx`:

1. Add `import AlertPopover from "./AlertPopover";`
2. Add `import { PRICE_ALERT_TOKENS } from "@/types/priceAlerts";`
3. Add state `const [alertOpen, setAlertOpen] = useState(false);`
4. Add ref `const alertBtnRef = useRef<HTMLButtonElement>(null);`
5. Compute `const isAlertSupported = PRICE_ALERT_TOKENS.some(t => t.symbol === token.symbol);`
6. Replace the existing `onAlert` handler:

   ```ts
   // Before
   const onAlert = () => {
     router.push(`/notifications?token=${encodeURIComponent(token.symbol)}`);
     onClose();
   };

   // After
   const onAlert = () => {
     if (!isAlertSupported) return;
     setAlertOpen((o) => !o);
   };
   ```

7. Update the Alert `ActionButton` to receive `ref={alertBtnRef}` and `disabled={!isAlertSupported}` and a `title` when disabled. This requires extending `ActionButton` to forward a ref and accept `disabled` + `title`.

   ```tsx
   <ActionButton
     ref={alertBtnRef}
     icon={<Bell size={16} />}
     label="Alert"
     onClick={onAlert}
     disabled={!isAlertSupported}
     title={
       !isAlertSupported
         ? "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX"
         : undefined
     }
   />
   ```

8. Render the popover at the end of the drawer JSX (so it overlays correctly):

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

## ActionButton change

The existing `ActionButton` is internal to `drawer/index.tsx`. Add ref-forwarding + `disabled` + `title` support:

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
      className="..."  // existing classes + disabled:opacity-40 disabled:cursor-not-allowed
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
});
```

Other usages of `ActionButton` (Swap, Send, Receive) don't pass `disabled` or `title` — defaults preserve current behavior.

## Behavior Details

### Dismiss
- Click the × button in the popover header.
- Click outside the popover (use a `mousedown` listener on `document`; ignore clicks inside the popover and inside the anchor button).
- Press `Escape`. The listener calls `e.stopPropagation()` so it does NOT propagate to the drawer's own ESC handler. The drawer's ESC handler is in `drawer/index.tsx` shell — both listeners are attached to `window`; the popover listener must be installed AFTER the shell's and capture before bubble. Use `{ capture: true }` to guarantee order.

### Create flow
- On submit:
  - Validate `parseFloat(targetPrice)` is a finite number > 0; otherwise set `error` and don't submit.
  - Call `addAlert(token.symbol, geckoIdForThisToken, condition, parsedPrice)`.
  - Clear `targetPrice`, clear `error`.
  - Keep `condition` as user chose (don't reset).
  - Popover stays open. Existing-alerts list re-renders from store.

### Delete flow
- Click `[×]` on an existing-alert row → call `removeAlert(alert.id)`.

### Push prompt
- Render `showPushPrompt` block.
- `[Bật]` → `setSubscribing(true); await subscribe(); setSubscribing(false); setPushPromptDismissed(true);`
- `[Bỏ qua]` → `setPushPromptDismissed(true);`
- The prompt does not auto-close the popover. User closes manually.

### Pre-fill chip behavior
- `[+5% $1.49]` click → `setTargetPrice('1.49'); setCondition('above'); setError('');`
- `[-5% $1.35]` click → `setTargetPrice('1.35'); setCondition('below'); setError('');`
- Format chip price using existing `formatPrice` helper (duplicated locally in AlertPopover.tsx per spec YAGNI rule).

### Live summary
- Only render when `parseFloat(targetPrice) > 0`.
- Text: `Alert when {token.symbol} {condition === 'above' ? 'rises above' : 'drops below'} ${parseFloat(targetPrice).toLocaleString()}`.
- Match phrasing of existing `PriceAlertForm` summary so users get consistent messaging.

## Error Handling

| Case | Behavior |
|---|---|
| Empty / non-numeric target price | Inline error below input. Form does not submit. |
| Target price `<= 0` | Same inline error. |
| `subscribe()` rejects (permission denied) | `subscribing` clears. No error toast — user already knows they denied. Push prompt stays dismissed for the session. |
| Token without geckoId (shouldn't happen — shell guards) | Defensive: popover returns `null` if `!geckoIdForThisToken`. |
| Duplicate alert (same token + condition + price) | Allowed. Both appear in the existing-alerts list. Store does not dedupe today, and silently dropping would confuse users who can see their input was accepted in the form yet doesn't appear.  |

## Accessibility

- Popover container: `role="dialog" aria-modal="false" aria-labelledby="alert-popover-title"`.
- The Alert button has `aria-expanded={alertOpen}` and `aria-haspopup="dialog"`.
- × close button has `aria-label="Close price alert"`.
- Existing-alert delete buttons have `aria-label={`Delete ${condition} ${price} alert`}`.
- When the popover opens, focus moves to the first interactive element (the first chip if current price > 0, otherwise the target-price input). When closed, focus returns to the Alert button (`anchorRef.current?.focus()`).
- Tab order: chips → condition radios → target input → Create → existing alert × buttons → close button.

## Testing

### Manual (verification gate)
1. STX drawer → Alert button enabled → click → popover opens above button.
2. Click `+5%` chip → input shows the suggested price; condition is `above`.
3. Click Create → existing-alerts list shows the new alert; input cleared.
4. Click `[×]` next to the alert → it disappears from the list.
5. Press ESC → popover closes; drawer stays open.
6. Click outside popover (but inside drawer) → popover closes; drawer stays open.
7. Open drawer for aeUSDC (no geckoId in PRICE_ALERT_TOKENS) → Alert button greyed; hovering shows the tooltip; click does nothing.
8. With zero alerts: create first alert in a fresh browser profile → push prompt appears at the bottom of the popover. Click `Bật` → browser permission dialog. Click `Bỏ qua` → prompt hides for the session.
9. Free port 3000 when done.

### E2E (Playwright, optional but recommended)
Two specs added to `e2e/`:

1. **`drawer-alert-popover.spec.ts`** — opens STX detail drawer, clicks Alert, clicks +5% chip, clicks Create, asserts the new alert appears in the existing-alerts list and the input is empty. Clicks ESC; asserts popover closes and drawer is still open.
2. **`drawer-alert-disabled.spec.ts`** — opens drawer for a non-whitelist token; asserts Alert button has `disabled` attribute and `title` matching the tooltip text.

These use the existing `e2e/fixtures/test-utils.ts` mock-wallet fixture. New alerts are written to localStorage (Zustand persist) — tests must clear localStorage in `beforeEach`.

### Unit
No new unit tests. The `priceAlertStore` already has its own coverage (if any). This feature is pure UI wiring.

## Implementation Order Hint

Suggested commit cadence for the plan:

1. Extend `ActionButton` to forward ref + accept `disabled`/`title`. Verify Swap/Send/Receive still render unchanged.
2. Create `AlertPopover.tsx` with form + create flow (no existing-alerts list, no push prompt, no chips yet). Render unconditionally from shell, wire toggle.
3. Add existing-alerts list with delete.
4. Add +5%/-5% suggestion chips.
5. Add push prompt block + dismiss logic.
6. Add tooltip / disabled state for non-whitelist tokens.
7. Add focus management + a11y attributes.
8. Add e2e tests.

Each step builds on the previous, each commit stays buildable.

## Risks

| Risk | Mitigation |
|---|---|
| Popover ESC handler closes the drawer too | Use `{ capture: true }` and `e.stopPropagation()`. Verify manually that pressing ESC inside the popover only closes the popover. |
| Click-outside listener fires when clicking on the Alert button itself, causing instant re-close | Skip if the click target is inside `anchorRef.current`. |
| Mobile drawer is full-width — desktop popover positioning breaks | Use Tailwind responsive classes: `sm:absolute sm:right-2 sm:bottom-full` for desktop anchored placement; `bottom-2 right-2 left-2` for mobile bottom sheet-like placement. |
| `addAlert` doesn't return the new alert id, so we can't focus the newly-added row | Not required for v1. Skip. |
| The shell currently routes alert clicks to `/notifications` — removing this might surprise users who rely on the deeplink | The full `/notifications` page remains the canonical management UI; users can still navigate there manually. The drawer popover is an additive shortcut. |

## Out of Scope (deferred)

- Editing existing alerts (delete + recreate is the v1 affordance).
- Dynamic whitelist based on holdings.
- Email / Telegram channels.
- Snooze / pause individual alerts.
- Alert templates (e.g. "alert on 10% move from now").
