"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Horizontal scroll container with edge-fade affordances. On mobile the bubbles
 * toolbar scrolls sideways with hidden scrollbars, so users had no hint that
 * more controls existed off-screen — fade overlays appear on whichever edge has
 * more content. On `sm:` the wrapper collapses to `display: contents`, so its
 * children rejoin the parent's flex-wrap layout (no scroll, no fades) exactly as
 * if this wrapper weren't here.
 *
 * Note: keep elements with pop-over menus OUTSIDE this scroller. An
 * `overflow-x: auto` container computes `overflow-y` to `auto` too, which clips
 * any dropdown that extends below the row.
 */
export default function EdgeFadeScroller({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setEdges({
        left: scrollLeft > 1,
        right: scrollLeft + clientWidth < scrollWidth - 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative min-w-0 flex-1 sm:contents">
      <div ref={ref} className={className}>
        {children}
      </div>
      <div
        aria-hidden
        className="sm:hidden pointer-events-none absolute inset-y-0 left-0 w-6 transition-opacity duration-200"
        style={{
          opacity: edges.left ? 1 : 0,
          background: "linear-gradient(to right, var(--bg-base), transparent)",
        }}
      />
      <div
        aria-hidden
        className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-6 transition-opacity duration-200"
        style={{
          opacity: edges.right ? 1 : 0,
          background: "linear-gradient(to left, var(--bg-base), transparent)",
        }}
      />
    </div>
  );
}
