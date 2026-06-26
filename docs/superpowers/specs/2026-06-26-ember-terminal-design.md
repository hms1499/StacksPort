# Ember Terminal — Visual Identity Upgrade

**Date:** 2026-06-26
**Status:** Approved design, pending implementation plan
**Scope:** Frontend visual identity only. No contract, keeper, API, or behavior changes.

## Goal

The app is already polished but reads as a generic green-on-navy crypto dashboard
with no ownable identity. Give StacksPort a distinctive, professional visual
identity — **Ember Terminal**: the *warmth* of a Bitcoin/Stacks-native palette
(ember orange + Stacks violet on warm ink) combined with the *sharpness* of a
financial terminal (mono numerals, hairline borders, near-sharp corners,
data-dense surfaces).

Decisions locked with the user:
- Direction: **Ember Terminal** (confirmed via visual mockups).
- Modes: **both light + dark**.
- Semantics: **green up / red down** (standard, not brand-colored).
- Phases: **all 4**.
- Mono numerals: **high-value numeric points only** (not every number app-wide).

## Architecture / leverage

The app is token-driven: components read CSS custom properties (`var(--accent)`,
`var(--bg-surface)`, `var(--text-primary)`, …) defined in `src/app/globals.css`
under `:root` (light) and `.dark` (dark), bridged into Tailwind via `@theme`.
This means:

- **Palette re-skin = editing token values in one file** (`globals.css`).
  ~48+ components change with zero per-component edits.
- **Corner sharpening = overriding the Tailwind radius scale** in `@theme`
  (`--radius-lg/xl/2xl`). 134 files use `rounded-xl/2xl` literally; remapping the
  scale sharpens all of them at once — no find/replace.
- **Mono numerals are NOT token-driven.** Number formatting lives in utils and is
  rendered inline across many components; there is no single Money component. So
  mono is applied **selectively** at high-value call sites via a shared utility
  class. `AnimatedCounter` accepts `className`, so animated financial counters
  opt in by passing the class.

## Token spec

### Dark — "warm ink"
```
--bg-base:#14110D  --bg-surface:#1B1712  --bg-card:#221D16  --bg-elevated:#2A241C
--border-subtle:#2A241C  --border-default:#3A3228  --border-active:rgba(247,147,26,.35)
--accent:#F7931A  --accent-bright:#FFA733  --accent-dim:rgba(247,147,26,.10)  --accent-glow:rgba(247,147,26,.20)
--accent-2:#8A6BFF  --accent-2-dim:rgba(138,107,255,.12)   (NEW: Stacks violet secondary)
--text-primary:#F2EBDF  --text-secondary:#9A8E7C  --text-muted:#6E6356
--positive:#3FB950  --negative:#F0506E  --warning:#FBBF24
```

### Light — "warm paper"
```
--bg-base:#F5F0E8  --bg-surface:#FFFDFA  --bg-card:#FFFFFF  --bg-elevated:#FBF7F0
--border-subtle:#ECE3D4  --border-default:#DCCFBA  --border-active:rgba(217,122,15,.40)
--accent:#F7931A (vivid, for FILLS)  --accent-text:#B45F09 (NEW: AA-safe ember for TEXT/icons on light)
--accent-2:#6D4FE0  --accent-2-dim:rgba(109,79,224,.12)
--text-primary:#1A140D  --text-secondary:#6E6356  --text-muted:#9A8E7C
--positive:#1F9D45  --negative:#D63B5C  --warning:#B45309
```

**Contrast note (must verify):** ember (`#F7931A`) as *text* on warm paper fails
WCAG AA. Phase 1 audits every `var(--accent)` usage and splits text-grade usage
onto `--accent-text` (`#B45F09`) in light mode; `--accent` stays the vivid fill
color. In dark mode `--accent` already passes as both fill and text, so
`--accent-text` maps back to `--accent` there.

### DCA / hero / shadow tokens
- `--dca-in-*` → ember→violet gradient; `--dca-out-*` → violet→rose. (Tunable;
  must stay visually distinct in/out.)
- `--hero-bg-*` radial gradients retinted warm.
- `--shadow-card*` keep dark-on-warm; light shadows warmed slightly
  (`rgba(40,28,12,.06)`).

## The 4 phases

### Phase 1 — Palette re-skin
Rewrite `:root` + `.dark` token blocks in `globals.css` per the spec above.
Add `--accent-2` / `--accent-2-dim` and (light) `--accent-text`. Extend the
`@theme inline` bridge with `--color-accent-2` (+ `--color-accent-text` if a
namespaced class is needed). Reconcile DCA/hero/shadow tokens.
**Risk:** low. **Touch:** 1 file (+ verify).

### Phase 2 — Sharpen geometry
In `@theme`, override `--radius-lg`, `--radius-xl`, `--radius-2xl` to sharp
values (≈4 / 5 / 6px) and lower the `--radius` custom prop (used by shadcn
primitives) to ~4px. Spot-check primary surfaces (cards, modals/TxSheet, sidebar
items, buttons, inputs).
**Risk:** low–medium (global geometry shift). **Touch:** 1 file (+ visual verify).

### Phase 3 — Mono data identity
Add a shared utility (e.g. `.font-data` = `font-family:var(--font-mono)` +
`font-variant-numeric:tabular-nums`). Apply at high-value numeric points only:
- Portfolio / balance values (dashboard, assets)
- Token prices & % changes
- Big stat numbers (APY, cycle, counts)
- DCA / swap amounts, `AmountField` displayed value
- Chart / sparkline axis & tick labels
- Uppercase mono micro-labels on card section headers (the terminal "tell")

`AnimatedCounter` call sites pass `className="font-data"`. Target ~15–25
prioritized spots; explicitly NOT every number app-wide (avoids layout shift &
churn).
**Risk:** medium (per-site edits). **Touch:** ~15–25 components.

### Phase 4 — Violet as real secondary
Use `--accent-2` (violet) on secondary surfaces to establish the dual-accent
Stacks DNA: DCA accents, AI (Stacks AI) surface, sBTC badges, secondary
links/highlights (e.g. unstake link). Ember stays primary/CTA; violet is the
"second voice".
**Risk:** low–medium. **Touch:** handful of components.

## Testing & verification
- `npm run build` and `npm run lint` after each phase; read output before claiming done.
- `npm run test:e2e` (or at least chromium project) green — only visuals change,
  DOM/flows untouched, so no breakage expected; run to confirm.
- Light-mode contrast: verify ember-on-paper text uses `--accent-text` and meets
  AA for body/label sizes; verify `--text-muted` on surfaces stays ≥ AA-large.
- Manual visual pass per mode (light + dark) on: dashboard, assets, trade, dca,
  earn, TxSheet, sidebar, bottom nav.
- No layout shift from mono swap (tabular-nums + check widths on counters).

## Out of scope
- `contracts/`, `keeper-bot/`, API routes, business logic, i18n strings.
- The bubbles physics canvas and the GSAP landing hero keep their bespoke
  treatments; they only inherit token color changes, no structural restyle.
- New components / features. This is identity, not layout redesign.

## Risks & mitigations
- **Single `--accent` token used for both text and fill** → split `--accent-text`
  in light mode (Phase 1 audit step).
- **Global radius change looks off on a specific surface** → spot-check list in
  Phase 2; per-surface override only if needed.
- **Mono swap shifts numeric widths** → `tabular-nums`; verify animated counters.
- **134 rounded-* files** → handled via theme remap, not edits.
