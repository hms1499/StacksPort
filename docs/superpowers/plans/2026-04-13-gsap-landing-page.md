# GSAP Landing Page Animations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the landing page (`src/app/page.tsx`) from Framer Motion to GSAP with scroll-driven parallax, count-up stats, batch stagger, and SVG draw-on animations.

**Architecture:** Install GSAP, create a `useGSAP` hook for lifecycle management, then rewrite `page.tsx` section-by-section replacing all Framer Motion with GSAP timelines and ScrollTrigger. Each section is a self-contained GSAP context.

**Tech Stack:** GSAP 3.x (free), ScrollTrigger plugin, React 19, Next.js 15, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-gsap-landing-page-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/hooks/useGSAP.ts` | GSAP context lifecycle hook — creates scoped context, auto-reverts on unmount |
| Create | `src/lib/gsap.ts` | GSAP + ScrollTrigger registration, shared easing presets |
| Modify | `src/app/page.tsx` | Remove Framer Motion, add refs, wire GSAP animations per section |
| Modify | `package.json` | Add `gsap` dependency |

---

### Task 1: Install GSAP and create registration module

**Files:**
- Modify: `package.json`
- Create: `src/lib/gsap.ts`

- [ ] **Step 1: Install GSAP**

```bash
npm install gsap
```

- [ ] **Step 2: Create GSAP registration module**

Create `src/lib/gsap.ts`:

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/gsap.ts
git commit -m "feat: install gsap and create registration module"
```

---

### Task 2: Create useGSAP lifecycle hook

**Files:**
- Create: `src/hooks/useGSAP.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useGSAP.ts`:

```ts
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Creates a GSAP context scoped to a container ref.
 * All GSAP animations inside `callback` are auto-reverted on unmount.
 *
 * @param callback - receives the scoped gsap context's `self` for selector scoping
 * @param deps - React dependency array (default: [])
 * @returns containerRef to attach to the root DOM element
 */
export function useGSAP<T extends HTMLElement = HTMLDivElement>(
  callback: (self: gsap.Context) => void,
  deps: React.DependencyList = []
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      callback(ctx!);
    }, containerRef.current);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGSAP.ts
git commit -m "feat: add useGSAP lifecycle hook with scoped context"
```

---

### Task 3: Migrate Hero section — entry timeline + floating cards

**Files:**
- Modify: `src/app/page.tsx`

This task replaces the Framer Motion `fadeUp` helper and floating card animations with GSAP timelines.

- [ ] **Step 1: Replace imports**

In `src/app/page.tsx`, replace the Framer Motion import and `fadeUp` helper:

Old:
```tsx
import { motion } from 'framer-motion';
```

New:
```tsx
import { useRef, useEffect, useState } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';
```

Also remove the existing `useEffect, useState` from the React import since we're consolidating, and remove the `fadeUp` function (lines 16-22).

- [ ] **Step 2: Add refs for hero elements**

Inside the `Home` component, after the existing state declarations, add refs:

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const heroRef = useRef<HTMLSectionElement>(null);
const dotGridRef = useRef<HTMLDivElement>(null);
const ambientGlowRef = useRef<HTMLDivElement>(null);
const floatingCardsRef = useRef<HTMLDivElement>(null);
const heroBadgeRef = useRef<HTMLDivElement>(null);
const heroH1Ref = useRef<HTMLHeadingElement>(null);
const heroSubRef = useRef<HTMLParagraphElement>(null);
const heroButtonsRef = useRef<HTMLDivElement>(null);
const heroTrustRef = useRef<HTMLDivElement>(null);
const portfolioCardRef = useRef<HTMLDivElement>(null);
const dcaCardRef = useRef<HTMLDivElement>(null);
const execBadgeRef = useRef<HTMLDivElement>(null);
const svgPathRef = useRef<SVGPathElement>(null);
const svgFillRef = useRef<SVGPathElement>(null);
```

- [ ] **Step 3: Add hero entry timeline + floating cards useEffect**

After the existing `useEffect` (isConnected redirect), add:

```tsx
useEffect(() => {
  if (!containerRef.current) return;

  const ctx = gsap.context(() => {
    // ── Hero entry timeline ──
    const heroEntryEls = [
      heroBadgeRef.current,
      heroH1Ref.current,
      heroSubRef.current,
      heroButtonsRef.current,
      heroTrustRef.current,
    ];

    gsap.set(heroEntryEls, { opacity: 0, y: 28 });

    const tl = gsap.timeline({ delay: 0.1 });
    heroEntryEls.forEach((el, i) => {
      if (!el) return;
      tl.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        ease: "power3.out",
      }, i * 0.1);
    });

    // ── SVG chart draw-on (after entry completes) ──
    if (svgPathRef.current) {
      const path = svgPathRef.current;
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: "power2.inOut",
      }, 0.5);
    }
    if (svgFillRef.current) {
      gsap.set(svgFillRef.current, { opacity: 0 });
      tl.to(svgFillRef.current, {
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
      }, 1.0);
    }

    // ── Floating cards ──
    if (portfolioCardRef.current) {
      gsap.to(portfolioCardRef.current, {
        y: -10, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    }
    if (dcaCardRef.current) {
      gsap.to(dcaCardRef.current, {
        y: -7, duration: 5.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.8,
      });
    }
    if (execBadgeRef.current) {
      gsap.to(execBadgeRef.current, {
        opacity: 0.6, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    }

    // ── Hero parallax on scroll ──
    if (heroRef.current) {
      const parallaxTrigger = {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
      };

      if (dotGridRef.current) {
        gsap.to(dotGridRef.current, {
          y: -50,
          scrollTrigger: parallaxTrigger,
        });
      }
      if (ambientGlowRef.current) {
        gsap.to(ambientGlowRef.current, {
          y: -30,
          scrollTrigger: parallaxTrigger,
        });
      }
      if (floatingCardsRef.current) {
        gsap.to(floatingCardsRef.current, {
          y: 40,
          scrollTrigger: parallaxTrigger,
        });
      }
    }
  }, containerRef.current);

  return () => ctx.revert();
}, []);
```

- [ ] **Step 4: Update Hero JSX — attach refs, remove motion components**

Replace the hero section JSX. The root `<div>` of the page gets `ref={containerRef}`. The hero `<section>` gets `ref={heroRef}`. Replace all `<motion.div>` / `<motion.h1>` / `<motion.p>` with plain `<div>` / `<h1>` / `<p>` with the corresponding refs.

Key changes:
- Root wrapper: `<div ref={containerRef} className="min-h-screen flex flex-col" ...>`
- Hero section: `<section ref={heroRef} ...>`
- Ambient glow div: add `ref={ambientGlowRef}`
- Dot grid div: add `ref={dotGridRef}`
- Badge wrapper: `<div ref={heroBadgeRef}>` (was `<motion.div {...fadeUp(0)}>`)
- H1: `<h1 ref={heroH1Ref}>` (was `<motion.h1 {...fadeUp(1)}>`)
- Subtitle: `<p ref={heroSubRef}>` (was `<motion.p {...fadeUp(2)}>`)
- Buttons wrapper: `<div ref={heroButtonsRef}>` (was `<motion.div {...fadeUp(3)}>`)
- Trust badges: `<div ref={heroTrustRef}>` (was `<motion.div {...fadeUp(4)}>`)
- Floating cards container: `<div ref={floatingCardsRef} ...>`
- Portfolio card: `<div ref={portfolioCardRef}>` (was `<motion.div animate={{ y: [0, -10, 0] }} ...>`)
- DCA card: `<div ref={dcaCardRef}>` (was `<motion.div animate={{ y: [0, -7, 0] }} ...>`)
- Executions badge: `<div ref={execBadgeRef}>` (was `<motion.div animate={{ opacity: [0.6, 1, 0.6] }} ...>`)
- SVG path: add `ref={svgPathRef}` to the stroke path, `ref={svgFillRef}` to the fill path

Remove all `{...fadeUp(n)}`, `animate={{...}}`, `transition={{...}}` props from these elements.

- [ ] **Step 5: Verify dev server renders hero correctly**

```bash
npm run dev
```

Open http://localhost:3000 — hero should fade in with stagger, floating cards should bob, parallax should work on scroll, SVG chart should draw in.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate hero section from Framer Motion to GSAP"
```

---

### Task 4: Migrate Stats Strip — count-up animation

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add refs for stats section**

Add to the refs section in the component:

```tsx
const statsRef = useRef<HTMLElement>(null);
const statItemRefs = useRef<(HTMLDivElement | null)[]>([]);
const statValueRefs = useRef<(HTMLParagraphElement | null)[]>([]);
```

- [ ] **Step 2: Define stats data with numeric values for counting**

Replace the inline stats array with a constant above the component (near FEATURES/STEPS):

```tsx
const STATS = [
  { label: 'DCA Plans Created', value: 847, prefix: '', suffix: '+', decimals: 0 },
  { label: 'Volume Executed',   value: 2.1, prefix: '$', suffix: 'M', decimals: 1 },
  { label: 'Active Users',      value: 1200, prefix: '', suffix: '+', decimals: 0, useComma: true },
  { label: 'Avg Return',        value: 18.4, prefix: '+', suffix: '%', decimals: 1 },
];
```

- [ ] **Step 3: Add stats ScrollTrigger animation to the useEffect**

Inside the `gsap.context()` callback (after the hero parallax block), add:

```tsx
// ── Stats count-up ──
if (statsRef.current) {
  gsap.set(statItemRefs.current, { opacity: 0, y: 16 });

  ScrollTrigger.create({
    trigger: statsRef.current,
    start: "top 80%",
    once: true,
    onEnter: () => {
      // Fade in stat blocks
      gsap.to(statItemRefs.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.15,
      });

      // Count up each value
      STATS.forEach((stat, i) => {
        const el = statValueRefs.current[i];
        if (!el) return;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: stat.value,
          duration: 2,
          ease: "power2.out",
          delay: i * 0.15,
          onUpdate: () => {
            const formatted = stat.decimals > 0
              ? obj.val.toFixed(stat.decimals)
              : stat.useComma
                ? Math.round(obj.val).toLocaleString()
                : Math.round(obj.val).toString();
            el.textContent = `${stat.prefix}${formatted}${stat.suffix}`;
          },
        });
      });
    },
  });
}
```

- [ ] **Step 4: Update Stats Strip JSX**

Replace the stats section JSX:

```tsx
<section
  ref={statsRef}
  style={{ borderTop: '1px solid rgba(28,49,80,0.6)', borderBottom: '1px solid rgba(28,49,80,0.6)' }}
>
  <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
    {STATS.map(({ label, prefix, value, suffix, decimals, useComma }, i) => (
      <div
        key={label}
        ref={(el) => { statItemRefs.current[i] = el; }}
      >
        <p
          ref={(el) => { statValueRefs.current[i] = el; }}
          className="text-3xl md:text-4xl font-bold mb-1"
          style={{ color: '#00E5A0', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
        >
          {prefix}0{suffix}
        </p>
        <p
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: 'rgba(221,232,248,0.25)', letterSpacing: '0.08em' }}
        >
          {label}
        </p>
      </div>
    ))}
  </div>
</section>
```

Note: initial display shows `0` (or `$0M` etc.), then GSAP counts up when scrolled into view.

- [ ] **Step 5: Test in browser**

Scroll down to stats strip — numbers should count up from 0 with stagger. Should only trigger once.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add GSAP count-up animation for stats strip"
```

---

### Task 5: Migrate Features Grid — ScrollTrigger.batch

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add refs for features section**

```tsx
const featuresRef = useRef<HTMLElement>(null);
const featuresHeadingRef = useRef<HTMLDivElement>(null);
const featureCardRefs = useRef<(HTMLDivElement | null)[]>([]);
```

- [ ] **Step 2: Add features ScrollTrigger to useEffect**

Inside `gsap.context()`, add:

```tsx
// ── Features heading ──
if (featuresHeadingRef.current) {
  gsap.set(featuresHeadingRef.current, { opacity: 0, y: 20 });
  ScrollTrigger.create({
    trigger: featuresHeadingRef.current,
    start: "top 85%",
    once: true,
    onEnter: () => {
      gsap.to(featuresHeadingRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
      });
    },
  });
}

// ── Features batch stagger ──
const featureCards = featureCardRefs.current.filter(Boolean) as HTMLDivElement[];
if (featureCards.length > 0) {
  gsap.set(featureCards, { opacity: 0, y: 24 });
  ScrollTrigger.batch(featureCards, {
    start: "top 85%",
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.1,
      });
    },
  });
}
```

- [ ] **Step 3: Update Features JSX**

Replace `<motion.div>` cards with plain `<div>` + refs:

```tsx
<section id="features" ref={featuresRef} className="py-24 px-5 md:px-8">
  <div className="max-w-6xl mx-auto">
    <div ref={featuresHeadingRef} className="mb-14">
      {/* heading content unchanged */}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {FEATURES.map(({ icon: Icon, label, desc, color }, i) => (
        <div
          key={label}
          ref={(el) => { featureCardRefs.current[i] = el; }}
          className="rounded-2xl p-6 group"
          style={{
            backgroundColor: '#0E1E30',
            border: '1px solid rgba(28,49,80,0.8)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${color}10`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,49,80,0.8)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          {/* icon, label, desc content unchanged */}
        </div>
      ))}
    </div>
  </div>
</section>
```

Remove the `initial`, `whileInView`, `viewport`, `transition` props from the old `<motion.div>`.

- [ ] **Step 4: Test in browser**

Scroll to features — heading fades in first, then cards stagger in batches as they enter viewport.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate features grid to GSAP ScrollTrigger.batch"
```

---

### Task 6: Migrate How It Works — stagger slide-in

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add refs**

```tsx
const howRef = useRef<HTMLElement>(null);
const howHeadingRef = useRef<HTMLDivElement>(null);
const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);
```

- [ ] **Step 2: Add ScrollTrigger animation to useEffect**

```tsx
// ── How It Works ──
if (howHeadingRef.current) {
  gsap.set(howHeadingRef.current, { opacity: 0, y: 16 });
  ScrollTrigger.create({
    trigger: howHeadingRef.current,
    start: "top 85%",
    once: true,
    onEnter: () => {
      gsap.to(howHeadingRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
      });
    },
  });
}

const stepCards = stepCardRefs.current.filter(Boolean) as HTMLDivElement[];
if (stepCards.length > 0) {
  gsap.set(stepCards, { opacity: 0, x: -24 });
  ScrollTrigger.create({
    trigger: howRef.current,
    start: "top 75%",
    once: true,
    onEnter: () => {
      gsap.to(stepCards, {
        opacity: 1,
        x: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.15,
      });
    },
  });
}
```

- [ ] **Step 3: Update How It Works JSX**

Replace `<motion.div>` with plain `<div>` + refs:

```tsx
<section
  id="how-it-works"
  ref={howRef}
  className="py-24 px-5 md:px-8"
  style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
>
  <div className="max-w-3xl mx-auto">
    <div ref={howHeadingRef} className="text-center mb-14">
      {/* heading content unchanged */}
    </div>

    <div className="space-y-3">
      {STEPS.map(({ n, title, desc }, i) => (
        <div
          key={n}
          ref={(el) => { stepCardRefs.current[i] = el; }}
          className="flex gap-6 rounded-2xl p-6"
          style={{ backgroundColor: '#0E1E30', border: '1px solid rgba(28,49,80,0.8)' }}
        >
          {/* step content unchanged */}
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Test in browser**

Scroll to "How it works" — heading fades in, then 3 step cards slide in from left with stagger.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate how-it-works to GSAP stagger slide-in"
```

---

### Task 7: Migrate CTA section — parallax glow + stagger

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add refs**

```tsx
const ctaRef = useRef<HTMLElement>(null);
const ctaGlowRef = useRef<HTMLDivElement>(null);
const ctaH2Ref = useRef<HTMLHeadingElement>(null);
const ctaSubRef = useRef<HTMLParagraphElement>(null);
const ctaBtnRef = useRef<HTMLButtonElement>(null);
```

- [ ] **Step 2: Add CTA animations to useEffect**

```tsx
// ── CTA parallax glow ──
if (ctaGlowRef.current && ctaRef.current) {
  gsap.to(ctaGlowRef.current, {
    y: -20,
    scrollTrigger: {
      trigger: ctaRef.current,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
    },
  });
}

// ── CTA content stagger ──
const ctaEls = [ctaH2Ref.current, ctaSubRef.current, ctaBtnRef.current];
if (ctaEls[0]) {
  gsap.set(ctaEls, { opacity: 0, y: 20 });
  ScrollTrigger.create({
    trigger: ctaRef.current,
    start: "top 80%",
    once: true,
    onEnter: () => {
      gsap.to(ctaEls, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.1,
      });
    },
  });
}
```

- [ ] **Step 3: Update CTA JSX**

Replace `<motion.div>` wrapper with plain elements + refs:

```tsx
<section
  ref={ctaRef}
  className="py-28 px-5 md:px-8 relative overflow-hidden"
  style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
>
  <div
    ref={ctaGlowRef}
    className="absolute inset-0 pointer-events-none"
    style={{
      background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,229,160,0.07) 0%, transparent 70%)',
    }}
  />
  <div className="relative max-w-2xl mx-auto text-center">
    <h2
      ref={ctaH2Ref}
      className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
      style={{ letterSpacing: '-0.04em' }}
    >
      Start investing{' '}
      <span
        style={{
          backgroundImage: 'linear-gradient(135deg, #00E5A0 0%, #38BDF8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        on autopilot
      </span>
    </h2>
    <p ref={ctaSubRef} className="text-lg mb-10" style={{ color: 'rgba(221,232,248,0.45)' }}>
      Connect once, automate forever. Your first DCA plan takes less than two minutes.
    </p>
    <button
      ref={ctaBtnRef}
      onClick={handleConnect}
      disabled={connecting}
      className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl text-base font-bold transition-all duration-300 disabled:opacity-50"
      style={{
        backgroundColor: '#00E5A0',
        color: '#060C18',
        boxShadow: '0 0 40px rgba(0,229,160,0.35)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#00FFB3';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(0,229,160,0.55)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#00E5A0';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(0,229,160,0.35)';
      }}
    >
      {connecting ? 'Connecting…' : 'Connect Wallet'}
      <ArrowRight size={18} />
    </button>
  </div>
</section>
```

- [ ] **Step 4: Test in browser**

Scroll to CTA — glow has subtle parallax shift, heading/subtitle/button stagger in.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate CTA section to GSAP with parallax glow"
```

---

### Task 8: Final cleanup and verification

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Verify no Framer Motion imports remain in page.tsx**

Search `page.tsx` for any remaining `motion` or `framer-motion` references:

```bash
grep -n "motion\|framer" src/app/page.tsx
```

Expected: No results. If any remain, remove them.

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors or warnings related to GSAP/motion.

- [ ] **Step 3: Full scroll-through test**

Open http://localhost:3000 and test:
1. Hero: entry stagger animates on load, floating cards bob, SVG chart draws in
2. Scroll down: parallax on dot grid, ambient glow, floating cards
3. Stats: numbers count up from 0 when scrolled into view, triggers once
4. Features: heading fades in, cards batch-stagger in
5. How It Works: heading fades, step cards slide from left
6. CTA: glow parallax, content staggers in
7. Scroll back up: parallax reverses smoothly, no re-triggers on once-only animations

- [ ] **Step 4: Commit final state**

```bash
git add src/app/page.tsx
git commit -m "refactor: remove all Framer Motion from landing page"
```
