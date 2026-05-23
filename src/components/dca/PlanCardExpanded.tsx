"use client";

import { useState } from "react";
import { BarChart3, Zap, History } from "lucide-react";
import { type DCAPlan } from "@/lib/dca";
import OverviewTab from "./PlanCardTabs/OverviewTab";
import ExecuteTab from "./PlanCardTabs/ExecuteTab";
import HistoryTab from "./PlanCardTabs/HistoryTab";

type InnerTab = "overview" | "execute" | "history";

interface PlanCardExpandedProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
  onRequestCancel: () => void;
  defaultTab?: InnerTab;
}

const TABS: Array<{ key: InnerTab; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "execute",  label: "Execute",  icon: Zap },
  { key: "history",  label: "History",  icon: History },
];

export default function PlanCardExpanded({
  plan,
  currentBlock,
  onRefresh,
  onRequestCancel,
  defaultTab = "overview",
}: PlanCardExpandedProps) {
  const [active, setActive] = useState<InnerTab>(defaultTab);

  // Stable per-plan id prefix so multiple expanded cards on the same page
  // don't share tab/panel element ids.
  const idPrefix = `plan-${plan.id}`;

  return (
    <div className="border-t p-4 flex flex-col gap-3" style={{ borderColor: "var(--border-subtle)" }}>
      <div
        className="inline-flex gap-1 p-1 rounded-xl self-start"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        role="tablist"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              id={`${idPrefix}-tab-${key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(key)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                isActive
                  ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <Icon size={12} /> {label}
            </button>
          );
        })}
      </div>

      <div
        id={`${idPrefix}-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${active}`}
      >
        {active === "overview" && (
          <OverviewTab plan={plan} currentBlock={currentBlock} onRefresh={onRefresh} onRequestCancel={onRequestCancel} />
        )}
        {active === "execute" && (
          <ExecuteTab plan={plan} currentBlock={currentBlock} onRefresh={onRefresh} />
        )}
        {active === "history" && <HistoryTab planId={plan.id} />}
      </div>
    </div>
  );
}
