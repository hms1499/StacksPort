# Landing Home Roadmap

**Goal:** Reposition the home page around StacksPort's strongest product claim:
non-custodial STX-to-sBTC DCA on Stacks mainnet, while improving trust,
conversion, accessibility, maintainability, and discoverability.

**Delivery model:** Implement in ordered batches. Every commit must have one
reviewable purpose, include the relevant tests, and leave `npm run build`
green. Do not mix visual redesign work with wallet, metrics, or SEO behavior
changes in the same commit.

**Non-goals:**

- No new landing-page animation library.
- No authenticated route guard for `/dashboard`; guest/read-only dashboard
  access already exists and is intentional.
- No invented user counts, volume, audit status, partner logos, testimonials,
  or performance claims.
- No Privacy, Terms, Security, or social links until the destination exists.

---

## Baseline Decisions

1. The primary landing action is `Connect wallet`.
2. The secondary landing action is `Explore dashboard` and routes to
   `/dashboard` without connecting.
3. A connected user may still redirect from `/` to `/dashboard`; this behavior
   remains unless product analytics later show a reason to retain the landing
   page for connected users.
4. Replace `Audited contracts` with a verifiable open-source/on-chain claim.
5. Hero mock values must be labeled as product preview data. On-chain metrics
   are displayed only after a successful API response.
6. Product positioning leads with DCA. Portfolio, swap, alerts, and AI are
   supporting capabilities.
7. Contract addresses and the 0.3% protocol fee are first-class trust
   information, not hidden implementation details.

---

## Batch 1: Trust Claims

### Task 1.1 - Remove unverifiable and dead claims

**Files:**

- Modify `src/components/landing/Hero.tsx`
- Modify `src/components/landing/Footer.tsx`
- Modify `e2e/landing.spec.ts`

**Changes:**

- Replace `Audited contracts` with `Open-source contracts`.
- Link the trust claim to the repository or a dedicated security section.
- Label hero portfolio/execution values as preview data.
- Remove the placeholder Twitter URL.
- Remove `#` links for Privacy, Terms, and Security until real pages exist.
- Update assertions so tests reject the old audit claim and dead links.

**Acceptance:**

- The landing page makes no unsupported audit claim.
- No footer link points to `#` or a generic social homepage.
- Preview values cannot reasonably be mistaken for live protocol metrics.

**Commit:**

```text
fix(landing): remove unverifiable trust claims
```

### Task 1.2 - Add verifiable on-chain references

**Files:**

- Create `src/components/landing/TrustSection.tsx`
- Modify `src/app/page.tsx`
- Modify `e2e/landing.spec.ts`

**Changes:**

- Add mainnet vault contract links using the existing canonical constants.
- Explain non-custodial ownership, keeper execution, pause/cancel behavior, and
  the 0.3% per-swap protocol fee.
- Use explorer links with `target="_blank"` and safe `rel` attributes.
- Avoid duplicating contract address literals inside landing components.

**Acceptance:**

- Every security/fee statement is backed by current code or an explorer link.
- Both DCA directions are represented.

**Commit:**

```text
feat(landing): add verifiable protocol trust section
```

---

## Batch 2: CTA And Guest Journey

### Task 2.1 - Normalize wallet connection

**Files:**

- Modify `src/app/page.tsx`
- Modify `src/components/landing/Navbar.tsx`
- Modify `src/components/landing/Hero.tsx`
- Modify `src/components/landing/CTASection.tsx`
- Reuse `src/lib/wallet.ts`
- Modify `e2e/landing.spec.ts`

**Changes:**

- Use the shared `connectWallet()` adapter rather than duplicating address
  selection logic on the home page.
- Use one loading state across navbar, hero, and final CTA.
- Standardize labels to `Connect wallet`.
- Add accessible pending text and disabled behavior.

**Acceptance:**

- All landing wallet entry points call the same connection implementation.
- Repeated clicks cannot start parallel connection requests.

**Commit:**

```text
refactor(landing): share wallet connection flow
```

### Task 2.2 - Add the read-only dashboard path

**Files:**

- Modify `src/components/landing/Hero.tsx`
- Modify `src/components/landing/Navbar.tsx`
- Modify `src/components/landing/CTASection.tsx`
- Modify `e2e/landing.spec.ts`
- Modify `e2e/navigation.spec.ts`

**Changes:**

- Add `Explore dashboard` as a normal link to `/dashboard`.
- Keep connection as the primary conversion action.
- Verify disconnected users can open the dashboard and see market widgets plus
  the existing wallet banner.

**Acceptance:**

- Exploring the product never opens a wallet dialog.
- Guest dashboard navigation remains functional on desktop and mobile.

**Commit:**

```text
feat(landing): add read-only dashboard journey
```

---

## Batch 3: Hero Positioning

### Task 3.1 - Lead with DCA

**Files:**

- Modify `src/components/landing/Hero.tsx`
- Modify `src/components/landing/Navbar.tsx`
- Modify `src/components/landing/CTASection.tsx`
- Modify `e2e/landing.spec.ts`

**Copy direction:**

- Eyebrow: live/mainnet status.
- Headline: automated Bitcoin strategy or STX-to-sBTC DCA.
- Supporting copy: non-custodial, on-chain execution, pause/cancel control.
- Avoid `investing on autopilot`, guaranteed-growth language, or outcome claims.

**Acceptance:**

- A first-time visitor can identify product, chain, asset pair, and custody
  model from the first viewport.
- Mobile first viewport contains headline, value proposition, and both CTAs.

**Commit:**

```text
feat(landing): reposition hero around non-custodial DCA
```

---

## Batch 4: Product Walkthrough

### Task 4.1 - Replace the flat feature grid

**Files:**

- Create `src/components/landing/ProductWalkthrough.tsx`
- Remove or retire `src/components/landing/FeaturesSection.tsx`
- Modify `src/app/page.tsx`
- Add optimized assets under `public/landing/`
- Modify `e2e/landing.spec.ts`

**Sections:**

1. Automate STX to sBTC DCA.
2. Track portfolio and DCA performance.
3. Swap and receive execution/price alerts.

**Implementation notes:**

- Use real, sanitized product captures or purpose-built UI compositions.
- Use `next/image` with explicit dimensions and responsive `sizes`.
- Provide useful alt text; decorative images use empty alt text.
- Keep AI insights as a supporting mention, not the main product promise.

**Acceptance:**

- Each section connects a user problem, product behavior, and concrete outcome.
- Images do not contain wallet addresses or misleading balances.
- Mobile layout remains readable without horizontal overflow.

**Commit split:**

```text
feat(landing): add product walkthrough assets
feat(landing): replace feature grid with product walkthrough
```

The asset commit may be combined with the component commit only when the total
diff remains easy to review.

---

## Batch 5: Live Metrics Reliability

### Task 5.1 - Model partial metric availability

**Files:**

- Extract server logic from `src/app/api/metrics/route.ts`
- Create `src/lib/server/protocol-metrics.ts`
- Create `src/lib/server/protocol-metrics.test.ts`
- Modify `src/app/api/metrics/route.ts`

**Changes:**

- Return explicit availability for vault stats and price-derived metrics.
- Do not convert failed sources into authoritative zero values.
- Keep valid zero protocol values distinguishable from unavailable data.
- Validate malformed upstream responses before reading tuple fields.

**Acceptance:**

- Unit tests cover full success, one vault unavailable, prices unavailable,
  malformed Clarity response, and genuine zero usage.

**Commit:**

```text
fix(metrics): preserve upstream availability in protocol stats
```

### Task 5.2 - Render honest metric states

**Files:**

- Modify `src/components/dashboard/SocialProofStrip.tsx`
- Modify `e2e/landing.spec.ts`
- Optionally add a focused component test if the project test setup supports it
  without introducing a new test framework.

**Changes:**

- Render skeletons during initial load.
- Render only available metrics after success.
- Show a compact unavailable state when no authoritative metric exists.
- Expose a textual explanation instead of relying only on hover `title`.

**Acceptance:**

- Network failure never produces a row of fake zeroes.
- Genuine on-chain zeroes remain visible as zero.

**Commit:**

```text
fix(landing): show honest live-metric states
```

---

## Batch 6: Accessibility And Scroll Behavior

### Task 6.1 - Fix the real scroll container

**Files:**

- Modify `src/components/landing/Navbar.tsx`
- Modify `src/app/layout-client.tsx` only if a shared scroll reference is needed
- Modify `e2e/landing.spec.ts`

**Changes:**

- Observe the home page's scrolling `<main>`, not `window`.
- Verify navbar background/border state after scrolling.
- Close the mobile menu after route/hash navigation and on Escape.

**Commit:**

```text
fix(landing): track navbar state from app scroller
```

### Task 6.2 - Respect reduced motion

**Files:**

- Modify landing GSAP components
- Modify `src/app/globals.css`
- Modify `e2e/landing.spec.ts`

**Changes:**

- Detect `prefers-reduced-motion: reduce`.
- Skip infinite floating, pulse, chart draw, and parallax animations.
- Ensure content starts visible when motion is disabled.
- Keep focus state and interaction feedback non-motion-dependent.

**Acceptance:**

- Reduced-motion users see all content without waiting for animation.
- Normal-motion behavior remains unchanged.

**Commit:**

```text
fix(landing): respect reduced motion preferences
```

---

## Batch 7: Landing Design System Cleanup

### Task 7.1 - Consolidate tokens and interaction styles

**Files:**

- Modify `src/app/globals.css`
- Modify `src/components/landing/*.tsx`

**Changes:**

- Add scoped landing tokens/classes for surfaces, borders, muted text, primary
  CTA, secondary CTA, focus rings, and card hover states.
- Remove imperative `onMouseEnter`/`onMouseLeave` style mutations.
- Preserve the current Deep Cosmos visual language.
- Do not refactor app-wide UI primitives in this batch.

**Acceptance:**

- Landing interactions work for mouse, keyboard, and touch.
- Focus-visible styles are clear.
- Repeated color literals and hover handlers are substantially reduced.

**Commit split:**

```text
refactor(landing): add scoped landing design tokens
refactor(landing): replace imperative hover styles
```

---

## Batch 8: SEO And Public Completeness

### Task 8.1 - Add product metadata

**Files:**

- Modify `src/app/layout.tsx`
- Create `src/app/robots.ts`
- Create `src/app/sitemap.ts`
- Create `src/app/manifest.ts`
- Create an OG image via `src/app/opengraph-image.tsx` or a static asset
- Modify/add metadata tests where practical

**Changes:**

- Product-specific title and description containing Stacks, sBTC, and DCA.
- `metadataBase`, canonical URL, Open Graph, and Twitter card.
- Software application structured data on the landing page.
- Robots, sitemap, and web app manifest.

**Prerequisite:**

- Confirm the production origin and official social handle before hardcoding
  canonical/social URLs. Use a public environment variable for origin if
  deployments have multiple hosts.

**Commit split:**

```text
feat(seo): add StacksPort product metadata
feat(seo): add robots sitemap and manifest
```

### Task 8.2 - Final landing regression pass

**Files:**

- Modify `e2e/landing.spec.ts`
- Modify `e2e/navigation.spec.ts`

**Coverage:**

- Desktop and mobile first viewport.
- Primary wallet CTA and secondary dashboard CTA.
- No unsupported audit claim or dead footer link.
- Product walkthrough content.
- Metrics loading/success/unavailable states.
- Navbar scroll behavior.
- Reduced-motion rendering.
- Metadata endpoints and canonical tags where Playwright can observe them.

**Commit:**

```text
test(landing): cover trust conversion and accessibility flows
```

---

## Verification Gate For Every Batch

Run focused tests while iterating, then before each commit:

```bash
npm run lint
npm test
npm run build
npx playwright test e2e/landing.spec.ts e2e/navigation.spec.ts
```

For asset-heavy or responsive batches, also inspect at:

- 390 x 844
- 768 x 1024
- 1280 x 800
- 1440 x 900

Do not commit generated `.next` output or unrelated working-tree changes.

---

## Recommended Execution Order

1. Trust claim cleanup.
2. Verifiable trust section.
3. Shared wallet flow.
4. Read-only dashboard CTA.
5. DCA-first hero positioning.
6. Product walkthrough.
7. Metrics availability and UI states.
8. Navbar and reduced motion.
9. Landing token cleanup.
10. SEO and final regression coverage.

This order intentionally fixes misleading or risky content before investing in
new visuals, then stabilizes behavior before the final maintainability and SEO
passes.
