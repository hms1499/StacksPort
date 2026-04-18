"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import DCAHeroStats from "./DCAHeroStats";

export type DCATab = "in" | "out";

interface DCAHeroSectionProps {
  tab: DCATab;
  onTabChange: (tab: DCATab) => void;
  isConnected: boolean;
  userActivePlans: number;
  userNextSwapLabel: string | null;
}

const TABS: Array<{ key: DCATab; label: string; icon: typeof ArrowDownToLine }> = [
  { key: "in",  label: "DCA In",  icon: ArrowDownToLine },
  { key: "out", label: "DCA Out", icon: ArrowUpFromLine },
];

export default function DCAHeroSection({
  tab,
  onTabChange,
  isConnected,
  userActivePlans,
  userNextSwapLabel,
}: DCAHeroSectionProps) {
  const bgClass = tab === "in" ? "hero-bg-dca-in" : "hero-bg-dca-out";

  return (
    <section
      className={`glass-card rounded-3xl p-5 sm:p-6 ${bgClass}`}
      style={{
        transition: "background-image 300ms ease",
        boxShadow: "var(--shadow-card)",
      }}
      data-dca-hero
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8">
        {/* Left: tabs + title */}
        <div className="flex flex-col gap-3 lg:w-1/2">
          <div
            className="inline-flex gap-1 p-1 rounded-2xl self-start"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            role="tablist"
            aria-label="DCA mode"
          >
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(key)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={
                    active
                      ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                      : { color: "var(--text-muted)", opacity: 0.8 }
                  }
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              DCA Vault
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {tab === "in"
                ? "Automatically buy sBTC on a schedule with STX \u00b7 Powered by Bitflow"
                : "Automatically sell sBTC for USDCx on a schedule \u00b7 Powered by Bitflow"}
            </p>
          </div>
        </div>

        {/* Right: stats */}
        <div className="lg:w-1/2">
          <DCAHeroStats
            mode={tab}
            isConnected={isConnected}
            userActivePlans={userActivePlans}
            userNextSwapLabel={userNextSwapLabel}
          />
        </div>
      </div>
    </section>
  );
}
