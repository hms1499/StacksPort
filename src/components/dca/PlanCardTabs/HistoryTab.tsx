"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, History, RefreshCw } from "lucide-react";
import {
  getPlanExecutionHistory,
  microToSTX,
  type PlanExecutionEvent,
} from "@/lib/dca";

interface Props {
  planId: number;
}

type HistoryT = ReturnType<typeof useTranslations<"dca.history">>;

function timeAgo(ts: number, t: HistoryT): string {
  if (!ts) return t("pending");
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return t("secondsAgo", { n: diff });
  if (diff < 3600) return t("minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("hoursAgo", { n: Math.floor(diff / 3600) });
  return t("daysAgo", { n: Math.floor(diff / 86400) });
}

function shortTx(tx: string): string {
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`;
}

function statusColor(status: PlanExecutionEvent["status"]): string {
  if (status === "success") return "var(--positive)";
  if (status === "pending") return "var(--warning)";
  return "var(--negative)";
}

export default function HistoryTab({ planId }: Props) {
  const t = useTranslations("dca.history");
  const [items, setItems] = useState<PlanExecutionEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlanExecutionHistory(planId);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedLoad"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [planId, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const header = (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        {t("recentExecutions")} {items && items.length > 0 && `· ${items.length}`}
      </p>
      <button
        onClick={fetchHistory}
        disabled={loading}
        className="p-1 rounded-md disabled:opacity-40"
        style={{ color: "var(--text-muted)" }}
        aria-label={t("refreshAria")}
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );

  if (items === null) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl h-12 animate-pulse"
            style={{ background: "var(--bg-elevated)" }}
          />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div
          className="rounded-xl p-4 text-xs"
          style={{ background: "var(--bg-elevated)", color: "var(--negative)" }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center gap-2 text-center"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "var(--accent-dim)" }}
        >
          <History size={18} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("noExecutions")}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("noExecutionsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
      {items.map((ev) => (
        <a
          key={ev.txId}
          href={`https://explorer.hiro.so/txid/${ev.txId}?chain=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl p-3 flex items-center gap-3 hover:brightness-105 transition-all"
          style={{ background: "var(--bg-elevated)" }}
        >
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span
              className="text-xs font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {shortTx(ev.txId)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {ev.blockHeight === 0 && !ev.blockTime
                ? t("awaitingConfirmation")
                : (
                  <>
                    {ev.blockHeight > 0 && `${t("block", { height: ev.blockHeight })} · `}
                    {timeAgo(ev.blockTime, t)}
                  </>
                )}
            </span>
          </div>

          {ev.netSwapped !== undefined && (
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="text-xs font-semibold font-data"
                style={{ color: "var(--text-primary)" }}
              >
                {microToSTX(ev.netSwapped).toFixed(4)} STX
              </span>
              {ev.protocolFee !== undefined && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {t("fee", { amount: microToSTX(ev.protocolFee).toFixed(6) })}
                </span>
              )}
            </div>
          )}

          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold"
            style={{ color: statusColor(ev.status) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: statusColor(ev.status) }}
            />
            {ev.status === "success" ? t("statusSuccess") : ev.status === "pending" ? t("statusPending") : t("statusFailed")}
          </span>
          <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
        </a>
      ))}
    </div>
  );
}
