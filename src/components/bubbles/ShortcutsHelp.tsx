"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const ROWS: Array<{ keys: string[]; tKey: string }> = [
  { keys: ["/"], tKey: "search" },
  { keys: ["Esc"], tKey: "clear" },
  { keys: ["1", "2", "3"], tKey: "metric" },
  { keys: ["Q", "W", "E", "R", "T"], tKey: "timeframe" },
  { keys: ["A", "S", "D", "H"], tKey: "scope" },
  { keys: ["G"], tKey: "refresh" },
  { keys: ["P"], tKey: "pause" },
  { keys: ["L"], tKey: "list" },
  { keys: ["?"], tKey: "help" },
];

export default function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  const t = useTranslations("bubbles.shortcuts");
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
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="hover:opacity-80"
          >
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {ROWS.map((row) => (
            <li key={row.tKey} className="flex items-center justify-between gap-3">
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
                {t(`rows.${row.tKey}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
