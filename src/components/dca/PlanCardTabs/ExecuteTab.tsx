"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Zap, Loader2, AlertTriangle } from "lucide-react";
import { type DCAPlan, microToSTX, executePlan, DEFAULT_SWAP_ROUTER } from "@/lib/dca";

// Known-good router contracts. Anything outside this set is flagged as
// "custom" and the user must explicitly opt in via the Advanced disclosure.
const KNOWN_ROUTERS = new Set<string>([DEFAULT_SWAP_ROUTER]);

// SIP-010 contract id shape: SP/ST + base58 + "." + name (no spaces).
const CONTRACT_ID_RE = /^S[PT][0-9A-Z]+\.[a-zA-Z][a-zA-Z0-9-]*$/;
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
import { useNotificationStore } from "@/store/notificationStore";
import { useWalletStore } from "@/store/walletStore";
import { trackTx } from "@/lib/tx-tracker";

interface ExecuteTabProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
}

export default function ExecuteTab({ plan, currentBlock, onRefresh }: ExecuteTabProps) {
  const t = useTranslations("dca.execute");
  const { addNotification } = useNotificationStore();
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const [routerInput, setRouterInput] = useState(DEFAULT_SWAP_ROUTER);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      .catch((e: Error) => setQuoteError(e.message ?? t("failedQuote")))
      .finally(() => setQuoteLoading(false));
  }, [canExecuteNow, netUstx, t]);

  const trimmedRouter = routerInput.trim();
  const routerValid = CONTRACT_ID_RE.test(trimmedRouter);
  const isCustomRouter = routerValid && !KNOWN_ROUTERS.has(trimmedRouter);

  const handleExecute = () => {
    if (!routerValid) return;
    // Defence-in-depth: the button is already gated on quotedSbtc != null, but
    // submitting with minAmountOut === 0 would strip slippage protection
    // entirely (the contract accepts 0 as a valid minimum), so reject here too.
    if (quotedSbtc == null || minAmountOut <= 0) return;
    setLoading(true);
    executePlan(plan.id, trimmedRouter, minAmountOut,
      ({ txId }) => {
        setLoading(false);
        addNotification(t("executedToast"), "success", "dca", 5000,
          { planId: String(plan.id), txId, action: "executed" });
        trackTx({
          txId,
          label: t("executedTxLabel", { id: plan.id }),
          category: "dca",
          context: { planId: String(plan.id), txId, action: "executed" },
          addNotification,
          address: stxAddress,
        });
        onRefresh();
      },
      () => {
        setLoading(false);
        addNotification(t("executionFailed"), "error", "dca", 5000, { planId: String(plan.id) });
      },
    );
  };

  if (!canExecuteNow) {
    const reason = !plan.active
      ? t("paused")
      : plan.bal < plan.amt
        ? t("insufficient", { amount: microToSTX(plan.amt - plan.bal).toFixed(2) })
        : plan.leb === 0
          ? t("pendingFirst")
          : t("nextIn", { count: blocksLeft });
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-elevated)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("notReady", { reason })}
        </p>
      </div>
    );
  }

  return (
    <div className="gradient-border-dca-in rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap size={13} style={{ color: "var(--accent-text)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t("readyToExecute")}</span>
        <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>{t("protocolFee")}</span>
      </div>

      {/* Quote */}
      <div className="rounded-lg p-2.5 flex flex-col gap-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("swapAmount", { amount: microToSTX(netUstx).toFixed(4) })}
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
                    : { background: "var(--accent-dim)", color: "var(--accent-text)" }
                }
              >
                {s}%
              </button>
            ))}
            <span className="text-[10px] self-center ml-0.5" style={{ color: "var(--text-muted)" }}>{t("slip")}</span>
          </div>
        </div>
        {quoteLoading ? (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={11} className="animate-spin" /> {t("fetchingQuote")}
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
              {t("minSats", { amount: minAmountOut })}
            </span>
          </div>
        ) : null}
      </div>

      {/* Router — default hidden; advanced users can override under disclosure */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {t("routingVia")} <span className="font-mono">bitflow-sbtc-swap-router</span>
          </span>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[10px] font-semibold focus:outline-none focus:underline"
            style={{ color: "var(--accent-text)" }}
          >
            {showAdvanced ? t("hide") : t("advanced")}
          </button>
        </div>
        {showAdvanced && (
          <div className="flex flex-col gap-1.5 mt-1">
            <input
              type="text"
              value={routerInput}
              onChange={(e) => setRouterInput(e.target.value)}
              placeholder={t("routerPlaceholder")}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:ring-2"
              style={{
                border: `1px solid ${routerValid ? "var(--border-subtle)" : "var(--negative)"}`,
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            {!routerValid && (
              <span className="text-[10px]" style={{ color: "var(--negative)" }}>
                {t("invalidContract")}
              </span>
            )}
            {isCustomRouter && (
              <span
                className="inline-flex items-start gap-1 text-[10px] leading-tight rounded-md px-2 py-1.5"
                style={{
                  background: "color-mix(in srgb, var(--warning) 12%, transparent)",
                  color: "var(--warning)",
                  border: "1px solid color-mix(in srgb, var(--warning) 28%, transparent)",
                }}
              >
                <AlertTriangle size={11} className="mt-px shrink-0" />
                <span>{t("customRouterWarn")}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setRouterInput(DEFAULT_SWAP_ROUTER)}
              className="text-[10px] self-start focus:outline-none focus:underline"
              style={{ color: "var(--text-muted)" }}
            >
              {t("resetDefault")}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleExecute}
        disabled={loading || quoteLoading || !!quoteError || quotedSbtc == null || !routerValid}
        className="gradient-dca-in px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 self-start"
      >
        <Zap size={13} /> {loading ? t("executing") : t("execute")}
      </button>
    </div>
  );
}
