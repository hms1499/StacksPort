"use client";

import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { type SwapToken } from "@/lib/direct-swap";
import { TokenImage } from "@/components/ui";

export function SimpleTokenSelector({
  tokens,
  selected,
  onChange,
  label,
}: {
  tokens: SwapToken[];
  selected: SwapToken | null;
  onChange: (t: SwapToken) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = `tokensel-${label.toLowerCase()}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openMenu() {
    const sel = tokens.findIndex((t) => t.id === selected?.id);
    setActiveIndex(sel >= 0 ? sel : 0);
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(t: SwapToken) {
    onChange(t);
    closeMenu();
  }

  function onListKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, tokens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(tokens.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const t = tokens[activeIndex];
      if (t) commit(t);
    }
  }

  return (
    <div ref={ref} className="relative">
      <p id={`${listboxId}-label`} className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listboxId}-label`}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
      >
        {selected ? (
          <>
            <TokenImage src={selected.icon} symbol={selected.symbol} size={24} fallback="none" />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {selected.symbol}
            </span>
            <span className="text-xs truncate flex-1 text-left" style={{ color: 'var(--text-muted)' }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span className="text-sm flex-1 text-left" style={{ color: 'var(--text-muted)' }}>Select token</span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="max-h-52 overflow-y-auto outline-none"
          >
            {tokens.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No tokens available</p>
            ) : (
              tokens.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === t.id}
                  ref={(el) => {
                    if (i === activeIndex && open) el?.focus();
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(t)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors text-left outline-none"
                  style={{
                    backgroundColor:
                      i === activeIndex
                        ? 'var(--bg-elevated)'
                        : selected?.id === t.id
                        ? 'var(--accent-dim)'
                        : 'transparent',
                  }}
                >
                  <TokenImage src={t.icon} symbol={t.symbol} size={24} fallback="none" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {t.symbol}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.name}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
