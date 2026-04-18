"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { type DCAPlan, microToSTX, executePlan, DEFAULT_SWAP_ROUTER } from "@/lib/dca";
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
import { useNotificationStore } from "@/store/notificationStore";

interface ExecuteTabProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
}

export default function ExecuteTab({ plan, currentBlock, onRefresh }: ExecuteTabProps) {
  const { addNotification } = useNotificationStore();
  const [routerInput, setRouterInput] = useState(DEFAULT_SWAP_ROUTER);
  const [slippage, setSlippage] = useState(1);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quotedSbtc, setQuotedSbtc] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  const netUstx = netUstxAfterFee(plan.amt);
  const minAmountOut = quotedSbtc != null ? Math.floor(quotedSbtc * (1 - slippage / 100) * 1e8) : 0;

  useEffect(() => {
    if (!canExecuteNow) return;
    setQuoteLoading(true); setQuoteError(null); setQuotedSbtc(null);
    quoteSbtcForUstx(netUstx)
      .then(setQuotedSbtc)
      .catch((e: Error) => setQuoteError(e.message ?? "Failed to get quote"))
      .finally(() => setQuoteLoading(false));
  }, [canExecuteNow, netUstx]);

  const handleExecute = () => {
    if (!routerInput.includes(".")) return;
    setLoading(true);
    executePlan(plan.id, routerInput.trim(), minAmountOut,
      ({ txId }) => {
        setLoading(false);
        addNotification("Plan executed! Swap completed", "success", "dca", 5000,
          { planId: String(plan.id), txId, action: "executed" });
        onRefresh();
      },
      () => {
        setLoading(false);
        addNotification("Execution failed", "error", "dca", 5000, { planId: String(plan.id) });
      },
    );
  };

  if (!canExecuteNow) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-elevated)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Not ready to execute. {plan.leb === 0 ? "Pending first swap." : `Next in ~${blocksLeft} blocks.`}
        </p>
      </div>
    );
  }

  return (
    <div className="gradient-border-dca-in rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap size={13} style={{ color: "var(--accent)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ready to Execute</span>
        <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>0.3% protocol fee</span>
      </div>

      {/* Quote */}
      <div className="rounded-lg p-2.5 flex flex-col gap-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Swap {microToSTX(netUstx).toFixed(4)} STX
          </span>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                style={
                  slippage === s
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--accent-dim)", color: "var(--accent)" }
                }
              >
                {s}%
              </button>
            ))}
            <span className="text-[10px] self-center ml-0.5" style={{ color: "var(--text-muted)" }}>slip</span>
          </div>
        </div>
        {quoteLoading ? (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={11} className="animate-spin" /> Fetching quote…
          </span>
        ) : quoteError ? (
          <span className="text-xs" style={{ color: "var(--negative)" }}>{quoteError}</span>
        ) : quotedSbtc != null ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
              ≥ {(quotedSbtc * (1 - slippage / 100)).toFixed(8)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>sBTC</span>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
              min {minAmountOut} sats
            </span>
          </div>
        ) : null}
      </div>

      {/* Router */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Swap Router</label>
        <input
          type="text"
          value={routerInput}
          onChange={(e) => setRouterInput(e.target.value)}
          placeholder="SP….swap-router-contract"
          className="w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <button
        onClick={handleExecute}
        disabled={loading || quoteLoading || !!quoteError || !routerInput.includes(".")}
        className="gradient-dca-in px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 self-start"
      >
        <Zap size={13} /> {loading ? "Executing…" : "Execute"}
      </button>
    </div>
  );
}
