// src/components/ai/YourPositionCard.tsx
"use client";

import { useTranslations } from "next-intl";
import { Sparkles, CheckCircle2, RefreshCw } from "lucide-react";
import { usePortfolioInsights } from "@/hooks/usePortfolioInsights";
import AlertRow from "./AlertRow";

export default function YourPositionCard({ address }: { address: string }) {
  const t = useTranslations("ai.position");
  const { data, error, isLoading, isValidating, mutate } = usePortfolioInsights(address);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent-text)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t("title")}</h3>
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent-text)" }}>{t("badge")}</span>
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
          {t("error")}
        </p>
      )}

      {data && data.alerts.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <CheckCircle2 size={16} style={{ color: "var(--accent-text)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("healthy")}
          </span>
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, i) => (
            <AlertRow key={i} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
