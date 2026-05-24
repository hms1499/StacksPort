"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, History, RefreshCw } from "lucide-react";
import {
  getSBTCPlanExecutionHistory,
  satsToBTC,
  type SBTCPlanExecutionEvent,
  type DCA_SBTCPlan,
} from "@/lib/dca-sbtc";

interface Props {
  plan: DCA_SBTCPlan;
}

// USDCx is the only Out target token in production; hardcode 6 until a second
// target ships (matches the rationale in the dca-out performance work).
const TARGET_DECIMALS = 6;

function timeAgo(ts: number): string {
  if (!ts) return "pending";
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortTx(tx: string): string {
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`;
}

function statusColor(status: SBTCPlanExecutionEvent["status"]): string {
  if (status === "success") return "var(--positive)";
  if (status === "pending") return "var(--warning)";
  return "var(--negative)";
}

function formatTokenOut(units: number): string {
  return (units / Math.pow(10, TARGET_DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OutPlanHistory({ plan }: Props) {
  const [items, setItems] = useState<SBTCPlanExecutionEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSBTCPlanExecutionHistory(plan.id, plan.token, 100, plan.owner);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [plan.id, plan.token, plan.owner]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const header = (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        Recent executions {items && items.length > 0 && `· ${items.length}`}
      </p>
      <button
        onClick={fetchHistory}
        disabled={loading}
        className="p-1 rounded-md disabled:opacity-40"
        style={{ color: "var(--text-muted)" }}
        aria-label="Refresh history"
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
          style={{ background: "var(--dca-out-dim)" }}
        >
          <History size={18} style={{ color: "var(--dca-out-primary)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          No executions yet
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Swaps will appear here once the keeper runs this plan.
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
                ? "Awaiting confirmation"
                : (
                  <>
                    {ev.blockHeight > 0 && `Block #${ev.blockHeight} · `}
                    {timeAgo(ev.blockTime)}
                  </>
                )}
            </span>
          </div>

          {ev.status === "success" && (
            <div className="flex flex-col items-end gap-0.5">
              {ev.sbtcIn !== undefined && (
                <span
                  className="text-xs font-semibold font-data"
                  style={{ color: "var(--text-primary)" }}
                >
                  {satsToBTC(ev.sbtcIn).toFixed(8)} sBTC
                </span>
              )}
              {ev.tokenOut !== undefined && (
                <span className="text-[10px] font-data" style={{ color: "var(--text-muted)" }}>
                  → {formatTokenOut(ev.tokenOut)} USDCx
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
            {ev.status}
          </span>
          <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
        </a>
      ))}
    </div>
  );
}
