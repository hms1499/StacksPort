"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

type Tab = "in" | "out";

export default function PerformanceTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  const t = useTranslations("dca.perf.tabs");
  const items: { id: Tab; label: string }[] = [
    { id: "in", label: t("in") },
    { id: "out", label: t("out") },
  ];
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ in: null, out: null });

  // Roving tabindex + arrow-key nav, per WAI-ARIA tablist pattern.
  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = items.length - 1;
    else return;
    e.preventDefault();
    const nextId = items[nextIdx].id;
    onChange(nextId);
    refs.current[nextId]?.focus();
  };

  return (
    <div
      className="flex items-center gap-1 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
      role="tablist"
      aria-label={t("aria")}
    >
      {items.map((it, idx) => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            ref={(el) => { refs.current[it.id] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => handleKey(e, idx)}
            className="px-4 py-2 text-sm font-semibold transition-colors relative focus:outline-none focus-visible:ring-2 rounded-t"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {it.label}
            {isActive && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5"
                style={{ backgroundColor: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
