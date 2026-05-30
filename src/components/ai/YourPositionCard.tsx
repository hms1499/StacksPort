// src/components/ai/YourPositionCard.tsx
"use client";

import type { CSSProperties } from "react";
import { Sparkles, Zap, AlertTriangle, Info, CheckCircle2, RefreshCw } from "lucide-react";
import { usePortfolioInsights } from "@/hooks/usePortfolioInsights";
import type { PersonalAlert } from "@/lib/ai-portfolio";

const AMBER = "#F59E0B";
const BLUE = "#3B82F6";

const typeConfig: Record<PersonalAlert["type"], { icon: typeof Zap; rowStyle: CSSProperties; iconStyle: CSSProperties }> = {
  opportunity: { icon: Zap, rowStyle: { borderLeftColor: "var(--accent)", backgroundColor: "var(--accent-dim)" }, iconStyle: { color: "var(--accent)" } },
  warning: { icon: AlertTriangle, rowStyle: { borderLeftColor: AMBER, backgroundColor: "rgba(245,158,11,0.10)" }, iconStyle: { color: AMBER } },
  info: { icon: Info, rowStyle: { borderLeftColor: BLUE, backgroundColor: "rgba(59,130,246,0.10)" }, iconStyle: { color: BLUE } },
};

const priorityBadge: Record<PersonalAlert["priority"], CSSProperties> = {
  high: { backgroundColor: "rgba(248,113,113,0.15)", color: "#F87171" },
  medium: { backgroundColor: "rgba(251,191,36,0.15)", color: "#FBBF24" },
  low: { backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" },
};

export default function YourPositionCard({ address }: { address: string }) {
  const { data, error, isLoading, isValidating, mutate } = usePortfolioInsights(address);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Your Position</h3>
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>Personalized</span>
        </div>
        <button onClick={() => mutate()} disabled={isValidating}
          className="flex items-center gap-1.5 text-xs disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
          <RefreshCw size={12} className={isValidating ? "animate-spin" : ""} />
        </button>
      </div>

      {isLoading && !data && (
        <div className="space-y-2 animate-pulse">
          {[0, 1].map((i) => <div key={i} className="h-14 rounded-xl" style={{ backgroundColor: "var(--bg-elevated)" }} />)}
        </div>
      )}

      {error && !data && (
        <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
          Couldn&apos;t load your alerts. Try refreshing in a moment.
        </p>
      )}

      {data && data.alerts.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Your portfolio looks healthy — no alerts right now.
          </span>
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, i) => {
            const config = typeConfig[alert.type];
            const Icon = config.icon;
            return (
              <div key={i} className="flex gap-3 p-3 rounded-xl border-l-4" style={config.rowStyle}>
                <Icon size={18} className="shrink-0 mt-0.5" style={config.iconStyle} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{alert.title}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={priorityBadge[alert.priority]}>{alert.priority}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
