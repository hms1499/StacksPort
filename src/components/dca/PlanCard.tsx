"use client";

import { useState, useEffect } from "react";
import { Pause, Play, Trash2, PlusCircle, Clock, Repeat2, ChevronDown, ChevronUp, Zap, Loader2 } from "lucide-react";
import {
  type DCAPlan,
  microToSTX,
  stxToMicro,
  blocksToInterval,
  cancelPlan,
  pausePlan,
  resumePlan,
  depositToPlan,
  executePlan,
  TARGET_TOKENS,
  DEFAULT_SWAP_ROUTER,
} from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";

interface Props {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
}

function shortToken(contractId: string): string {
  const known = TARGET_TOKENS.find((t) => t.value === contractId);
  if (known) return known.label;
  const name = contractId.split(".")[1] ?? contractId;
  return name.length > 20 ? name.slice(0, 18) + "…" : name;
}

export default function PlanCard({ plan, currentBlock, onRefresh }: Props) {
  const { addNotification } = useNotificationStore();
  const [expanded, setExpanded] = useState(false);
  const [depositInput, setDepositInput] = useState("");
  const [routerInput, setRouterInput] = useState(DEFAULT_SWAP_ROUTER);
  const [slippage, setSlippage] = useState(1); // 1%
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quotedSbtc, setQuotedSbtc] = useState<number | null>(null); // sBTC amount (normal units)
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txInfo, setTxInfo] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const balSTX = microToSTX(plan.bal);
  const amtSTX = microToSTX(plan.amt);
  const remainingSwaps = plan.amt > 0 ? Math.floor(plan.bal / plan.amt) : 0;
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  // net uSTX after vault's 0.3% protocol fee (matches what router actually receives)
  const netUstx = plan.amt - Math.floor(plan.amt * 30 / 10000);

  // Query xyk-core.get-dx directly on mainnet — exact sBTC output for our specific pool
  // get-dx(pool, x-token=sBTC, y-token=wSTX, y-amount=uSTX) → (ok uint) satoshis
  useEffect(() => {
    if (!expanded || !canExecuteNow) return;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuotedSbtc(null);

    async function fetchPoolQuote() {

      const { contractPrincipalCV, uintCV, serializeCV, hexToCV } = await import("@stacks/transactions");

      const toHex = (cv: unknown) => {
        const bytes = serializeCV(cv as Parameters<typeof serializeCV>[0]);
        const hex = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("hex");
        return "0x" + hex;
      };

      const args = [
        toHex(contractPrincipalCV("SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", "xyk-pool-sbtc-stx-v-1-1")),
        toHex(contractPrincipalCV("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token")),
        toHex(contractPrincipalCV("SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", "token-stx-v-1-2")),
        toHex(uintCV(netUstx)),
      ];

      const res = await fetch(
        "https://api.hiro.so/v2/contracts/call-read/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/xyk-core-v-1-2/get-dx",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: "SP000000000000000000002Q6VF78", arguments: args }),
        }
      );

      const data = await res.json();
      if (!data.okay) throw new Error(data.cause ?? "get-dx failed");

      // result is (ok uint) — unwrap to get satoshis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cv = hexToCV(data.result) as any;
      const sats = Number(cv?.value?.value ?? cv?.value ?? 0);
      if (!sats || sats <= 0) throw new Error("No liquidity in pool");

      setQuotedSbtc(sats / 1e8); // convert sats → sBTC normal units for display
    }

    fetchPoolQuote()
      .catch((e: Error) => {
        const error = e.message ?? "Failed to get quote";
        setQuoteError(error);
      })
      .finally(() => setQuoteLoading(false));
  }, [expanded, canExecuteNow, plan.amt]);

  // minAmountOut in satoshis (sBTC 8 decimals), applying slippage on pool's real quote
  const minAmountOut = quotedSbtc != null
    ? Math.floor(quotedSbtc * (1 - slippage / 100) * 1e8)
    : 0;

  function withLoading(fn: () => void) {
    setLoading(true);
    setTxInfo(null);
    fn();
  }

  const handlePause = () =>
    withLoading(() =>
      pausePlan(plan.id,
        ({ txId }) => { 
          setTxInfo(txId);
          setLoading(false);
          onRefresh();
        },
        () => {
          setLoading(false);
        }
      )
    );

  const handleResume = () =>
    withLoading(() =>
      resumePlan(plan.id,
        ({ txId }) => { 
          setTxInfo(txId);
          setLoading(false);
          onRefresh();
        },
        () => {
          setLoading(false);
        }
      )
    );

  const handleCancel = () => setShowCancelModal(true);

  const confirmCancel = () => {
    setShowCancelModal(false);
    withLoading(() =>
      cancelPlan(plan.id,
        ({ txId }) => {
          setTxInfo(txId);
          setLoading(false);
          addNotification('Plan cancelled & refunded', 'success', 'dca', 5000, { planId: String(plan.id), action: 'cancelled', amount: balSTX.toFixed(2) });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification('Failed to cancel plan', 'error', 'dca', 5000);
        }
      )
    );
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositInput);
    if (!amount || amount < 1) return;
    withLoading(() =>
      depositToPlan(plan.id, stxToMicro(amount),
        ({ txId }) => { 
          setTxInfo(txId);
          setDepositInput("");
          setLoading(false);
          onRefresh();
        },
        () => {
          setLoading(false);
        }
      )
    );
  };

  const handleExecute = () => {
    if (!routerInput.includes(".")) return;
    if (!plan.active) return;
    if (plan.bal < plan.amt) return;
    withLoading(() =>
      executePlan(plan.id, routerInput.trim(), minAmountOut,
        ({ txId }) => { 
          setTxInfo(txId);
          setLoading(false);
          addNotification('Plan executed! Swap completed', 'success', 'dca', 5000, { planId: String(plan.id), txId, action: 'executed' });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification('Execution failed', 'error', 'dca', 5000, { planId: String(plan.id) });
        }
      )
    );
  };

  const statusBadge = !plan.active ? (
    plan.bal > 0 ? (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-100">Paused</span>
    ) : (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Depleted</span>
    )
  ) : (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B0E4CC]/20 text-[#285A48] border border-[#B0E4CC]/30">Active</span>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Repeat2 size={16} className="text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400">STX</span>
            <span className="text-gray-200">→</span>
            <span className="text-sm font-semibold text-gray-900" title={plan.token}>{shortToken(plan.token)}</span>
            {statusBadge}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{blocksToInterval(plan.ivl)} · Plan #{plan.id}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{amtSTX.toFixed(2)} STX</p>
          <p className="text-xs text-gray-400">per swap</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="ml-1 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="flex justify-between text-[11px] text-gray-400 mb-1">
          <span>{balSTX.toFixed(2)} STX remaining</span>
          <span>{remainingSwaps} swaps left</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B0E4CC] rounded-full transition-all"
            style={{ width: `${plan.tss + plan.bal > 0 ? Math.round((plan.bal / (plan.tss + plan.bal)) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Next execution */}
      <div className="px-4 py-2 flex items-center gap-1.5">
        <Clock size={12} className={canExecuteNow ? "text-[#408A71]" : "text-gray-300"} />
        <span className={`text-[11px] ${canExecuteNow ? "text-[#285A48] font-medium" : "text-gray-400"}`}>
          {canExecuteNow ? "Ready to execute now" : plan.leb === 0 ? "Pending first swap" : `Next in ~${blocksLeft} blocks`}
        </span>
        {canExecuteNow && (
          <button
            onClick={() => setExpanded(true)}
            className="ml-auto text-[10px] font-semibold text-[#285A48] bg-[#B0E4CC]/20 border border-[#B0E4CC]/30 px-2 py-0.5 rounded-full hover:bg-[#B0E4CC]/30 transition-colors flex items-center gap-1"
          >
            <Zap size={10} /> Execute
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-50 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Swaps Done", value: plan.tsd },
              { label: "STX Spent", value: microToSTX(plan.tss).toFixed(1) },
              { label: "Block Created", value: plan.cat },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-2">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs font-semibold text-gray-700">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Target Token</p>
            <p className="text-xs font-mono text-gray-600 break-all">{plan.token}</p>
          </div>

          {/* Execute section */}
          {canExecuteNow && (
            <div className="bg-[#B0E4CC]/20 border border-[#B0E4CC]/30 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-[#408A71]" />
                <span className="text-xs font-semibold text-[#285A48]">Ready to Execute</span>
                <span className="ml-auto text-[11px] text-[#285A48] font-medium">0.3% protocol fee</span>
              </div>
              {/* Quote + slippage */}
              <div className="bg-white rounded-lg border border-[#B0E4CC]/30 px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#285A48] font-medium">
                    Estimated sBTC · swap {microToSTX(netUstx).toFixed(4)} STX
                  </span>
                  <div className="flex gap-1">
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlippage(s)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          slippage === s ? "bg-[#408A71] text-white" : "bg-[#B0E4CC]/20 text-[#285A48] hover:bg-[#B0E4CC]/30"
                        }`}
                      >
                        {s}%
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-400 self-center ml-0.5">slip</span>
                  </div>
                </div>
                {quoteLoading ? (
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Loader2 size={11} className="animate-spin" /> Fetching quote…
                  </span>
                ) : quoteError ? (
                  <span className="text-xs text-red-400">{quoteError}</span>
                ) : quotedSbtc != null ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-[#285A48]">
                      ≥ {(quotedSbtc * (1 - slippage / 100)).toFixed(8)}
                    </span>
                    <span className="text-xs text-gray-400">sBTC</span>
                    <span className="text-[10px] text-gray-300 ml-auto">
                      min {minAmountOut} sats
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#285A48] font-medium">Swap Router</label>
                <input
                  type="text"
                  placeholder="SP….swap-router-contract"
                  value={routerInput}
                  onChange={(e) => setRouterInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#B0E4CC] bg-white text-xs text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#B0E4CC] font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExecute}
                  disabled={loading || quoteLoading || !!quoteError || !routerInput.includes(".")}
                  className="px-4 py-2 rounded-lg bg-[#408A71] hover:bg-[#285A48] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Zap size={13} /> Execute
                </button>
              </div>
            </div>
          )}

          {/* Deposit more */}
          {plan.active && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="Deposit STX"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  className="w-full px-3 py-2 pr-12 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B0E4CC]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">STX</span>
              </div>
              <button
                onClick={handleDeposit}
                disabled={loading || !depositInput}
                className="px-3 py-2 rounded-xl bg-[#408A71] hover:bg-[#285A48] disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <PlusCircle size={14} /> Add
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {plan.active ? (
              <button onClick={handlePause} disabled={loading}
                className="flex-1 py-2 rounded-xl border border-yellow-200 text-yellow-600 hover:bg-yellow-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                <Pause size={14} /> Pause
              </button>
            ) : plan.bal >= plan.amt ? (
              <button onClick={handleResume} disabled={loading}
                className="flex-1 py-2 rounded-xl border border-[#B0E4CC] text-[#285A48] hover:bg-[#B0E4CC]/20 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                <Play size={14} /> Resume
              </button>
            ) : null}
            {(plan.active || plan.bal > 0) && (
              <button onClick={handleCancel} disabled={loading}
                className="flex-1 py-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                <Trash2 size={14} /> Cancel & Refund
              </button>
            )}
          </div>

          {txInfo && <p className="text-[11px] text-gray-400 break-all">Tx: {txInfo}</p>}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Cancel & Refund</h3>
                <p className="text-xs text-gray-400">Plan #{plan.id}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this plan? You will be refunded{" "}
              <span className="font-semibold text-gray-900">{balSTX.toFixed(2)} STX</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Keep Plan
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Cancel & Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
