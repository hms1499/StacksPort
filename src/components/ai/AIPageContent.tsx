"use client";

import { useTranslations } from "next-intl";
import { RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIInsights } from "@/hooks/useAIInsights";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import SentimentCard from "./SentimentCard";
import KOLSignalsCard from "./KOLSignalsCard";
import SmartAlertsCard from "./SmartAlertsCard";
import NewsDigestCard from "./NewsDigestCard";
import YourPositionCard from "./YourPositionCard";
import AskStacksAICard from "./AskStacksAICard";
import { useWalletStore } from "@/store/walletStore";

function timeAgo(iso: string, t: (key: string, values?: Record<string, number>) => string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t("time.justNow");
  if (diff < 3600) return t("time.minutesAgo", { n: Math.floor(diff / 60) });
  return t("time.hoursAgo", { n: Math.floor(diff / 3600) });
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-2xl p-5 shadow-sm animate-pulse", className)}>
      <div className="h-5 rounded w-1/3 mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="space-y-3">
        <div className="h-4 rounded w-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-4 rounded w-2/3" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
    </div>
  );
}

export default function AIPageContent() {
  const t = useTranslations("ai");
  const { data, error, isLoading, isValidating, mutate } = useAIInsights();
  const { isConnected, stxAddress } = useWalletStore();

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("title")} />

      <AnimatedPage className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--accent-2)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t("marketIntel")}
            </h2>
            {data && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t("updated", { time: timeAgo(data.generatedAt, t) })}
              </span>
            )}
          </div>
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors glass-card shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={13} className={isValidating ? "animate-spin" : ""} />
            {t("refresh")}
          </button>
        </div>

        {/* Personalized "Your Position" — independent of the global insights
            fetch, so it still renders while/if the shared market endpoint is
            loading or failing. */}
        {isConnected && stxAddress && (
          <div className="mb-4">
            <YourPositionCard address={stxAddress} />
          </div>
        )}

        {/* Error state */}
        {error && !data && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={40} className="mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t("error.title")}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {t("error.desc")}
            </p>
            <button
              onClick={() => mutate()}
              className="px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {t("retry")}
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton />
            <Skeleton />
            <Skeleton className="lg:col-span-2" />
            <Skeleton className="lg:col-span-2" />
          </div>
        )}

        {/* Data */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <NewsDigestCard summary={data.newsDigest.summary} items={data.newsDigest.items} />
            </div>
            <SentimentCard data={data.sentiment} />
            <KOLSignalsCard data={data.kolSignals} />
            <div className="lg:col-span-2">
              <SmartAlertsCard items={data.alerts.items} />
            </div>
            <div className="lg:col-span-2">
              <AskStacksAICard address={isConnected && stxAddress ? stxAddress : undefined} />
            </div>
          </div>
        )}
      </AnimatedPage>
    </div>
  );
}
