"use client";

import { Star, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type Scope = "all" | "stacks" | "watchlist" | "holdings";

interface ScopeToggleProps {
  value: Scope;
  onChange: (s: Scope) => void;
  stacksCount: number;
  watchlistCount: number;
  holdingsCount: number;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
        active
          ? "bg-[#408A71] text-white shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      )}
    >
      {children}
    </button>
  );
}

function Count({ active, n }: { active: boolean; n: number }) {
  return (
    <span
      className="text-[10px] px-1.5 rounded-full"
      style={{
        backgroundColor: active ? "rgba(255,255,255,0.2)" : "var(--border-subtle)",
      }}
    >
      {n}
    </span>
  );
}

export default function ScopeToggle({
  value,
  onChange,
  stacksCount,
  watchlistCount,
  holdingsCount,
}: ScopeToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      <Pill active={value === "all"} onClick={() => onChange("all")}>
        All
      </Pill>
      <Pill active={value === "stacks"} onClick={() => onChange("stacks")}>
        Stacks
        <Count active={value === "stacks"} n={stacksCount} />
      </Pill>
      <Pill active={value === "watchlist"} onClick={() => onChange("watchlist")}>
        <Star
          size={11}
          strokeWidth={2.5}
          fill={value === "watchlist" ? "#fbbf24" : "transparent"}
          color={value === "watchlist" ? "#fbbf24" : "currentColor"}
        />
        <Count active={value === "watchlist"} n={watchlistCount} />
      </Pill>
      <Pill active={value === "holdings"} onClick={() => onChange("holdings")}>
        <Wallet size={11} strokeWidth={2.5} />
        <Count active={value === "holdings"} n={holdingsCount} />
      </Pill>
    </div>
  );
}
