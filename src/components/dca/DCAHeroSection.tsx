"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp } from "lucide-react";
import DCAHeroStats from "./DCAHeroStats";

export type DCATab = "in" | "out";

interface DCAHeroSectionProps {
  tab: DCATab;
  onTabChange: (tab: DCATab) => void;
  isConnected: boolean;
  userActivePlans: number;
  userNextSwapLabel: string | null;
}

const TABS: Array<{ key: DCATab; labelKey: string; icon: typeof ArrowDownToLine }> = [
  { key: "in",  labelKey: "tabIn",  icon: ArrowDownToLine },
  { key: "out", labelKey: "tabOut", icon: ArrowUpFromLine },
];

const STORAGE_KEY = "dca:hero-collapsed";

export default function DCAHeroSection({
  tab,
  onTabChange,
  isConnected,
  userActivePlans,
  userNextSwapLabel,
}: DCAHeroSectionProps) {
  // Collapsed state is hydrated from localStorage in an effect (not the lazy
  // initializer) to avoid SSR/client markup mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("dca.hero");
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      // setState-in-effect is intentional: localStorage is not available during
      // SSR, so we render `false` first then sync on mount to avoid hydration
      // mismatch. A brief expanded → collapsed flicker is preferred over the
      // markup mismatch warning.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // First-time visitors and disconnected users must always see the full hero
  // (marketing/onboarding). Only returning users with active plans can collapse.
  const canCollapse = isConnected && userActivePlans > 0;
  const showCollapsed = canCollapse && collapsed;

  const bgClass = tab === "in" ? "hero-bg-dca-in" : "hero-bg-dca-out";

  const tabsRow = (
    <div
      className="inline-flex gap-1 p-1 rounded-2xl self-start"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      role="tablist"
      aria-label={t("modeAria")}
    >
      {TABS.map(({ key, labelKey, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(key)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={
              active
                ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                : { color: "var(--text-muted)", opacity: 0.8 }
            }
          >
            <Icon size={14} />
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  const collapseToggle = canCollapse && (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? t("expand") : t("collapse")}
      className="p-2 rounded-xl transition-colors hover:bg-[var(--bg-elevated)]"
      style={{ color: "var(--text-muted)" }}
    >
      {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
    </button>
  );

  if (showCollapsed) {
    return (
      <section
        className={`glass-card rounded-3xl px-4 py-2.5 ${bgClass}`}
        style={{ transition: "background-image 300ms ease", boxShadow: "var(--shadow-card)" }}
        data-dca-hero
        data-collapsed
      >
        <div className="flex items-center gap-3 flex-wrap">
          {tabsRow}
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("vault")}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            ·
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("activeCount", { count: userActivePlans })}
          </span>
          {userNextSwapLabel && (
            <>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
              <span className="text-xs font-medium font-data" style={{ color: "var(--text-secondary)" }}>
                {t("next", { label: userNextSwapLabel })}
              </span>
            </>
          )}
          <span className="ml-auto">{collapseToggle}</span>
        </div>
      </section>
    );
  }

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
          <div className="flex items-start justify-between gap-2">
            {tabsRow}
            <span className="lg:hidden">{collapseToggle}</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {t("vault")}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {tab === "in" ? t("subtitleIn") : t("subtitleOut")}
            </p>
          </div>
        </div>

        {/* Right: stats */}
        <div className="lg:w-1/2 lg:relative">
          <div className="hidden lg:block absolute top-0 right-0">{collapseToggle}</div>
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
