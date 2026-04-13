# GSAP Landing Page Animations — Design Spec

**Date:** 2026-04-13
**Scope:** Landing page only (`src/app/page.tsx`)
**Strategy:** Migrate landing page from Framer Motion to GSAP entirely. Framer Motion remains for app pages (dashboard, trade, etc.).
**Style:** Subtle & Refined — professional DeFi aesthetic, no flashy effects.

## Package

- `gsap` (free, ~24KB gzipped) — includes ScrollTrigger, TextPlugin
- No premium plugins required (no SplitText, DrawSVG, MorphSVG)

## Integration

- GSAP coexists with Framer Motion in the project; only `page.tsx` (landing) uses GSAP
- Register ScrollTrigger via `gsap.registerPlugin(ScrollTrigger)` in a `useGSAP` hook or `useEffect`
- Use `useRef` for element references, clean up timelines/ScrollTriggers on unmount
- Remove `framer-motion` import from `page.tsx`

---

## Section 1: Hero

### 1a. Entry Timeline (on mount)

- Single `gsap.timeline()` runs on component mount
- Stagger sequence: badge (0s) → headline (0.1s) → subtitle (0.2s) → buttons (0.3s) → trust badges (0.4s)
- Each element: `opacity: 0 → 1`, `y: 28 → 0`, duration 0.65s, ease `power3.out`

### 1b. Floating Cards (GSAP replaces Framer infinite loop)

- Portfolio card: `gsap.to(el, { y: -10, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut" })`
- DCA card: same pattern, duration 5.5s, delay 0.8s
- Executions badge: `opacity` pulse, duration 3s, repeat: -1, yoyo: true

### 1c. Parallax on Scroll

- Uses `ScrollTrigger` with `scrub: true` on hero section
- Dot grid layer: `y: -50` (moves slower than content)
- Ambient glow layer: `y: -30` (different speed, creates depth)
- Floating cards: `y: +40` (moves faster, "lifts" off background)

### 1d. SVG Mini Chart Draw-on

- Portfolio card SVG path uses `strokeDasharray` + `strokeDashoffset`
- Animated via GSAP timeline, triggers after hero fadeUp completes
- Line draws left → right, duration ~1.2s, ease `power2.inOut`

---

## Section 2: Stats Strip

- ScrollTrigger: `start: "top 80%"`, `once: true`
- Each counter: count from 0 → target value, duration 2s, ease `power2.out`
- Smart format parsing:
  - `847+` → count 0→847, append `+`
  - `$2.1M` → count 0→2.1, prepend `$`, append `M`
  - `1,200+` → count 0→1200, format with commas, append `+`
  - `+18.4%` → count 0→18.4, prepend `+`, append `%`
- Stagger 0.15s between 4 counters (left → right)
- Combined with `opacity: 0 → 1`, `y: 16 → 0` per stat block

---

## Section 3: Features Grid

- `ScrollTrigger.batch()` auto-detects cards entering viewport
- Animation: `opacity: 0 → 1`, `y: 24 → 0`, duration 0.55s, ease `power3.out`
- Stagger: 0.1s between batched cards
- `once: true`
- Section heading ("Everything you need") fades in separately (`start: "top 85%"`)
- Hover effects remain as CSS inline (no GSAP needed)

---

## Section 4: How It Works

- ScrollTrigger triggers when section heading enters viewport
- Heading "Three steps to automate" fades in first: `opacity: 0 → 1`, `y: 16 → 0`
- 3 step cards: stagger 0.15s, `opacity: 0 → 1`, `x: -24 → 0`, duration 0.55s, ease `power3.out`
- `once: true`

---

## Section 5: CTA

- Radial glow background: subtle parallax with `scrub: true`, `y` shift on scroll (creates depth like hero)
- Content stagger timeline triggered by ScrollTrigger (`once: true`):
  - Heading (0s) → subtitle (0.1s) → button (0.2s)
  - `opacity: 0 → 1`, `y: 20 → 0`, ease `power3.out`

---

## Technical Notes

- All ScrollTrigger instances use `once: true` except parallax scrub effects
- Cleanup: all timelines and ScrollTrigger instances killed on component unmount via `useEffect` return or `gsap.context().revert()`
- `gsap.context()` scoped to landing page container ref for safe cleanup
- No premium GSAP plugins — all animations use core + ScrollTrigger
- GSAP registered once at module level, not per render
