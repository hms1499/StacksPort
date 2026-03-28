"use client";

import { RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIInsights } from "@/hooks/useAIInsights";
import Topbar from "@/components/layout/Topbar";
import SentimentCard from "./SentimentCard";
import TrendAnalysisCard from "./TrendAnalysisCard";
import SmartAlertsCard from "./SmartAlertsCard";
import NewsDigestCard from "./NewsDigestCard";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 animate-pulse", className)}>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function AIPageContent() {
  const { data, error, isLoading, isValidating, mutate } = useAIInsights();

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Stacks AI" />

      <div className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#408A71]" />
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Market Intelligence
            </h2>
            {data && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Updated {timeAgo(data.generatedAt)}
              </span>
            )}
          </div>
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
              "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
              "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <RefreshCw size={13} className={isValidating ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error state */}
        {error && !data && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Failed to load insights
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Please check your API key configuration and try again
            </p>
            <button
              onClick={() => mutate()}
              className="px-4 py-2 bg-[#408A71] hover:bg-[#285A48] text-white text-sm font-medium rounded-xl transition-colors"
            >
              Retry
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
            <SentimentCard data={data.sentiment} />
            <TrendAnalysisCard data={data.trends} />
            <div className="lg:col-span-2">
              <SmartAlertsCard items={data.alerts.items} />
            </div>
            <div className="lg:col-span-2">
              <NewsDigestCard summary={data.newsDigest.summary} items={data.newsDigest.items} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
