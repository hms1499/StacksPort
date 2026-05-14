"use client";

import { cn } from "@/lib/utils";

export type Scope = "all" | "stacks";

interface ScopeToggleProps {
  value: Scope;
  onChange: (s: Scope) => void;
  stacksCount: number;
}

export default function ScopeToggle({ value, onChange, stacksCount }: ScopeToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      <button
        onClick={() => onChange("all")}
        className={cn(
          "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200",
          value === "all"
            ? "bg-[#408A71] text-white shadow-sm"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        )}
      >
        All
      </button>
      <button
        onClick={() => onChange("stacks")}
        className={cn(
          "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
          value === "stacks"
            ? "bg-[#408A71] text-white shadow-sm"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        )}
      >
        Stacks
        <span
          className="text-[10px] px-1.5 rounded-full"
          style={{
            backgroundColor: value === "stacks" ? "rgba(255,255,255,0.2)" : "var(--border-subtle)",
          }}
        >
          {stacksCount}
        </span>
      </button>
    </div>
  );
}
