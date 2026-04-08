# UI Polish & Subtle Micro-interactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle, consistent micro-interactions across the entire StacksPort app while keeping the existing Deep Cosmos theme and layout intact.

**Architecture:** Create a shared animations utility file that all components import from. Update existing components to use these shared variants instead of inline definitions. Polish hover/tap/transition states throughout sidebar, cards, buttons, modals, and page transitions.

**Tech Stack:** Framer Motion (already installed), CSS transitions, existing Tailwind utilities

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/animations.ts` | Shared Framer Motion variants and transition presets |
| Modify | `src/components/motion/AnimatedPage.tsx` | Use shared pageTransition variant |
| Modify | `src/components/motion/MotionCard.tsx` | Add hover border/shadow transition |
| Modify | `src/components/motion/StaggerChildren.tsx` | Use shared stagger variants |
| Modify | `src/components/layout/Sidebar.tsx` | layoutId active indicator, smooth hover, spring collapse, remove Premium |
| Modify | `src/components/layout/Topbar.tsx` | CSS transitions on hover states, dropdown animation |
| Modify | `src/components/layout/BottomNav.tsx` | layoutId active dot, remove Premium |
| Modify | `src/app/layout-client.tsx` | Wrap children in AnimatePresence |
| Modify | `src/app/globals.css` | Add focus-ring animation, number-flash utilities |

---

### Task 1: Create Shared Animation Utilities

**Files:**
- Create: `src/lib/animations.ts`

- [ ] **Step 1: Create the animations file**

```typescript
// src/lib/animations.ts
import type { Transition, Variants } from "framer-motion";

// ── Shared easing ──
export const easings = {
  snappy: [0.22, 1, 0.36, 1] as [number, number, number, number],
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// ── Page transition ──
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

export const pageSpring: Transition = {
  duration: 0.25,
  ease: easings.snappy,
};

// ── Stagger container ──
export function staggerContainer(staggerDelay = 0.05): Variants {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: staggerDelay },
    },
  };
}

// ── Stagger item ──
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easings.snappy },
  },
};

// ── Hover presets (for whileHover/whileTap) ──
export const hoverScale = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.985 },
  transition: { duration: 0.15 },
};

export const hoverScaleSubtle = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15 },
};

// ── Modal / Overlay ──
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const modalTransition: Transition = {
  duration: 0.2,
  ease: easings.smooth,
};

// ── Dropdown ──
export const dropdown: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const dropdownTransition: Transition = {
  duration: 0.15,
  ease: easings.smooth,
};

// ── Sidebar collapse spring ──
export const sidebarSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/animations.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/animations.ts
git commit -m "feat: add shared animation utilities for micro-interactions"
```

---

### Task 2: Update Motion Wrapper Components

**Files:**
- Modify: `src/components/motion/AnimatedPage.tsx`
- Modify: `src/components/motion/StaggerChildren.tsx`
- Modify: `src/components/motion/MotionCard.tsx`

- [ ] **Step 1: Update AnimatedPage to use shared variants**

Replace the entire content of `src/components/motion/AnimatedPage.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition, pageSpring } from "@/lib/animations";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedPage({ children, className }: AnimatedPageProps) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageSpring}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Update StaggerChildren to use shared variants**

Replace the entire content of `src/components/motion/StaggerChildren.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerContainer, staggerItem as sharedStaggerItem } from "@/lib/animations";

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export { sharedStaggerItem as staggerItem };

export default function StaggerChildren({
  children,
  className,
  staggerDelay = 0.05,
}: StaggerChildrenProps) {
  return (
    <motion.div
      variants={staggerContainer(staggerDelay)}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Update MotionCard to add hover border transition**

Replace the entire content of `src/components/motion/MotionCard.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerItem } from "./StaggerChildren";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
}

export default function MotionCard({ children, className }: MotionCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{
        borderColor: "var(--border-default)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/motion/AnimatedPage.tsx src/components/motion/StaggerChildren.tsx src/components/motion/MotionCard.tsx
git commit -m "refactor: motion components use shared animation utilities"
```

---

### Task 3: Polish Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add imports and remove Premium**

In `src/components/layout/Sidebar.tsx`, add `motion` and `AnimatePresence` imports and update navItems:

Replace:
```typescript
import { useState } from "react";
```
With:
```typescript
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sidebarSpring } from "@/lib/animations";
```

Remove the Premium item from navItems. Replace:
```typescript
  { href: "/ai",            label: "Stacks AI",  icon: Sparkles },
  { href: "/premium",       label: "Premium",    icon: Crown, soon: true },
];
```
With:
```typescript
  { href: "/ai",            label: "Stacks AI",  icon: Sparkles },
];
```

Remove the `Crown` import from lucide-react.

- [ ] **Step 2: Replace width transition with Framer Motion spring**

Replace the `<aside` opening tag (lines 35-43):
```typescript
    <aside
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        width: collapsed ? 64 : 220,
        transition: 'width 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className="h-screen flex flex-col relative shrink-0"
    >
```
With:
```typescript
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={sidebarSpring}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
      }}
      className="h-screen flex flex-col relative shrink-0"
    >
```

Also change closing `</aside>` to `</motion.aside>`.

- [ ] **Step 3: Add layoutId active indicator and CSS transitions on hover**

Remove the entire `soon` block (lines 75-100 — the `if (soon)` branch) since Premium is removed.

Replace the nav Link block (the `return (` inside `navItems.map`) with:

```typescript
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-[background-color,color] duration-200",
                active
                  ? "text-[var(--accent)] bg-[var(--accent-dim)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]",
              )}
              style={active ? { boxShadow: 'inset 0 0 0 1px var(--border-active)' } : undefined}
            >
              {/* Active indicator bar — animated between items */}
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={17} className="shrink-0 transition-colors duration-200" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
```

This removes all `onMouseEnter`/`onMouseLeave` handlers and uses Tailwind transitions instead.

- [ ] **Step 4: Polish collapse toggle button with CSS transitions**

Replace the collapse toggle button (lines 153-171) with:

```typescript
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
            "transition-[background-color,color] duration-200",
            "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-secondary)]",
          )}
        >
          {collapsed
            ? <PanelLeftOpen size={17} className="shrink-0" />
            : <PanelLeftClose size={17} className="shrink-0" />
          }
          {!collapsed && <span>Collapse</span>}
        </button>
```

- [ ] **Step 5: Add AnimatePresence for logo text**

Replace the logo text block:
```typescript
        {!collapsed && (
          <span
            className="font-bold text-base tracking-tight truncate"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
          >
            StacksPort
          </span>
        )}
```
With:
```typescript
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="font-bold text-base tracking-tight truncate overflow-hidden"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
            >
              StacksPort
            </motion.span>
          )}
        </AnimatePresence>
```

- [ ] **Step 6: Verify visually**

Run: `npm run dev`
Check: Navigate between sidebar items — active indicator should slide smoothly. Collapse/expand should use spring physics. Hover states should fade in smoothly.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: polish sidebar with layoutId indicator, spring collapse, CSS hover transitions"
```

---

### Task 4: Polish Topbar

**Files:**
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Add Framer Motion imports**

Add at top of file:
```typescript
import { motion, AnimatePresence } from "framer-motion";
import { dropdown, dropdownTransition } from "@/lib/animations";
```

- [ ] **Step 2: Replace theme toggle hover with CSS transitions**

Replace the theme toggle button (lines 72-89):
```typescript
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-colors hidden md:flex"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border-subtle)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          {theme === "dark"
            ? <Sun size={16} />
            : <Moon size={16} />
          }
        </button>
```
With:
```typescript
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-xl hidden md:flex",
            "transition-[background-color,color] duration-200",
            "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-secondary)]",
          )}
        >
          {theme === "dark"
            ? <Sun size={16} />
            : <Moon size={16} />
          }
        </button>
```

- [ ] **Step 3: Replace dropdown menu items hover with CSS transitions**

Replace all three dropdown button `onMouseEnter`/`onMouseLeave` patterns. For the Copy Address button (lines 140-152), Switch Account button (lines 154-163), and Disconnect button (lines 166-175), remove the `onMouseEnter`/`onMouseLeave` handlers and add Tailwind hover classes.

Copy Address button — replace:
```typescript
                  <button
                    onClick={handleCopyAddress}
                    className={cn("w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors")}
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
```
With:
```typescript
                  <button
                    onClick={handleCopyAddress}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                      "transition-[background-color] duration-150",
                      "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]",
                    )}
                  >
```

Switch Account button — replace:
```typescript
                  <button
                    onClick={() => { setDropdownOpen(false); void handleConnect(); }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
```
With:
```typescript
                  <button
                    onClick={() => { setDropdownOpen(false); void handleConnect(); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                      "transition-[background-color] duration-150",
                      "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]",
                    )}
                  >
```

Disconnect button — replace:
```typescript
                    <button
                      onClick={handleDisconnect}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
                      style={{ color: 'var(--negative)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240, 74, 110, 0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                    >
```
With:
```typescript
                    <button
                      onClick={handleDisconnect}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                        "transition-[background-color] duration-150",
                        "text-[var(--negative)] hover:bg-[rgba(240,74,110,0.08)]",
                      )}
                    >
```

- [ ] **Step 4: Animate dropdown open/close**

Replace the dropdown container (lines 118-178). Wrap with AnimatePresence and use motion.div:

Replace:
```typescript
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div
                  className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                >
```
With:
```typescript
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <motion.div
                    variants={dropdown}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={dropdownTransition}
                    className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
```

And change the matching closing tags. Replace:
```typescript
                </div>
              </>
            )}
```
With:
```typescript
                  </motion.div>
                </>
              )}
            </AnimatePresence>
```

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Check: Theme toggle hover fades smoothly. Wallet dropdown slides in/out. Menu items have smooth hover backgrounds.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Topbar.tsx
git commit -m "feat: polish topbar with CSS hover transitions and animated dropdown"
```

---

### Task 5: Polish BottomNav

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Add motion import and layoutId indicator**

Add at top:
```typescript
import { motion } from "framer-motion";
```

Replace the active indicator dot (lines 46-51):
```typescript
              {active && (
                <span
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
```
With:
```typescript
              {active && (
                <motion.span
                  layoutId="bottomnav-active"
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev` (mobile viewport)
Check: Active dot slides smoothly between nav items.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: polish bottom nav with layoutId sliding indicator"
```

---

### Task 6: Add Page Transition AnimatePresence

**Files:**
- Modify: `src/app/layout-client.tsx`

- [ ] **Step 1: Wrap children in AnimatePresence**

Replace:
```typescript
import { usePathname } from 'next/navigation';
```
With:
```typescript
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
```

Replace the main content area:
```typescript
      <main className={isHomePage ? 'w-full overflow-y-auto' : 'flex-1 overflow-y-auto pb-16 md:pb-0'}>
        {children}
      </main>
```
With:
```typescript
      <main className={isHomePage ? 'w-full overflow-y-auto' : 'flex-1 overflow-y-auto pb-16 md:pb-0'}>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>
```

- [ ] **Step 2: Verify page transitions work**

Run: `npm run dev`
Check: Navigating between pages should show fade transition (because each page uses AnimatedPage which now has exit variant).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout-client.tsx
git commit -m "feat: add AnimatePresence for page transitions"
```

---

### Task 7: Add CSS Utility Animations

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add focus ring animation and number flash utilities**

Append before the closing of the ANIMATIONS section (after line 160, before the FOCUS RING section):

```css
@keyframes number-flash-positive {
  0%   { color: var(--positive); }
  100% { color: inherit; }
}

@keyframes number-flash-negative {
  0%   { color: var(--negative); }
  100% { color: inherit; }
}

.flash-positive {
  animation: number-flash-positive 0.5s ease-out;
}

.flash-negative {
  animation: number-flash-negative 0.5s ease-out;
}
```

Replace the focus ring section (lines 165-169):
```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 8px;
}
```
With:
```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 8px;
  animation: focus-ring-in 0.15s ease-out;
}

@keyframes focus-ring-in {
  from { outline-color: transparent; }
  to   { outline-color: var(--accent); }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run dev`
Expected: No CSS errors in console.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add number flash and focus ring CSS animations"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full build check**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Visual QA checklist**

Run: `npm run dev` and verify each area:

1. **Sidebar**: Active indicator slides between items (layoutId). Hover fades in background. Collapse uses spring. Logo text fades in/out.
2. **Topbar**: Theme toggle hover smooth. Dropdown slides in/out. Menu items hover smooth.
3. **BottomNav**: Active dot slides between items on mobile.
4. **Cards**: Mount with stagger animation (0.05s delay). Hover shows border color change.
5. **Page transitions**: Navigating between pages shows fade + slide.
6. **Focus rings**: Tab-navigating shows animated ring appearance.
7. **Premium**: Removed from sidebar and bottom nav.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address visual QA issues from micro-interactions polish"
```
