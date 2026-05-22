"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  /** Form element to render inside. Always rendered on desktop. */
  children: ReactNode;
  /** Label for the mobile collapsed header (e.g. "Create DCA In plan"). */
  title: string;
  /** Window event that should auto-open the form on mobile when fired
   *  (e.g. "dca:fill-form" or "dca-out:fill-form"). */
  openOnEvent: string;
}

/**
 * Wraps a CreatePlanForm so it stays exactly as today on lg+, but on
 * mobile collapses behind a header button. This lets the user see their
 * existing plans first (more important on a small screen) and only
 * expand the form when they actively want to add a new plan.
 *
 * Auto-opens when `openOnEvent` fires (e.g. a preset chip in the empty
 * state), and scrolls itself into view so the user lands on it.
 *
 * The form is mounted exactly once — visibility is driven by max-height
 * + opacity transitions so SWR hooks and quote state inside the form
 * don't double up.
 */
export default function MobileCollapsibleForm({ children, title, openOnEvent }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onFill() {
      setOpen(true);
      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    window.addEventListener(openOnEvent, onFill);
    return () => window.removeEventListener(openOnEvent, onFill);
  }, [openOnEvent]);

  return (
    <div ref={rootRef}>
      {/* Mobile-only collapsed header (hidden on lg+) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="lg:hidden w-full glass-card rounded-2xl px-4 py-3 flex items-center justify-between transition-colors mb-3"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--accent-dim)" }}
          >
            <Plus size={14} style={{ color: "var(--accent)" }} />
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        </motion.span>
      </button>

      {/* Single form mount. Mobile: max-height/opacity transition gated
       *  on `open`. Desktop: always visible via lg:! overrides. */}
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          open ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0",
          "lg:!max-h-none lg:!opacity-100 lg:!overflow-visible",
        )}
      >
        {children}
      </div>
    </div>
  );
}
