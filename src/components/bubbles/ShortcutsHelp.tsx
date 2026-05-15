"use client";

import { X } from "lucide-react";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const ROWS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Focus search" },
  { keys: ["Esc"], label: "Clear / close" },
  { keys: ["1", "2", "3"], label: "Metric: % · MCap · Vol" },
  { keys: ["Q", "W", "E", "R", "T"], label: "Timeframe: 1h · 24h · 7d · 30d · 1y" },
  { keys: ["A", "S", "D"], label: "Scope: All · Stacks · Watchlist" },
  { keys: ["G"], label: "Refresh data" },
  { keys: ["P"], label: "Pause / resume motion" },
  { keys: ["?"], label: "Toggle this help" },
];

export default function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-4 motion-safe:animate-[fadeIn_150ms_ease-out]"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-4 w-full max-w-sm motion-safe:animate-[popIn_180ms_ease-out]"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:opacity-80"
          >
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {ROWS.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-base)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
                {row.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
