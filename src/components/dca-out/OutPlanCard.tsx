"use client";

import { useState } from "react";
import {
  Pause,
  Play,
  Trash2,
  PlusCircle,
  Clock,
  Repeat2,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import {
  type DCA_SBTCPlan,
  satsToBTC,
  btcToSats,
  blocksToInterval,
  cancelSBTCPlan,
  pauseSBTCPlan,
  resumeSBTCPlan,
  depositToSBTCPlan,
  executeSBTCPlan,
  SBTC_TARGET_TOKENS,
  DEFAULT_SBTC_SWAP_ROUTER,
} from "@/lib/dca-sbtc";
import { useNotificationStore } from "@/store/notificationStore";

interface Props {
  plan: DCA_SBTCPlan;
  currentBlock: number;
  onRefresh: () => void;
}

function shortToken(contractId: string): string {
  const known = SBTC_TARGET_TOKENS.find((t) => t.value === contractId);
  if (known) return known.label;
  const name = contractId.split(".")[1] ?? contractId;
  return name.length > 20 ? name.slice(0, 18) + "..." : name;
}

export default function OutPlanCard({ plan, currentBlock, onRefresh }: Props) {
  const { addNotification } = useNotificationStore();
  const [expanded, setExpanded] = useState(false);
  const [depositInput, setDepositInput] = useState("");
  const [routerInput, setRouterInput] = useState(DEFAULT_SBTC_SWAP_ROUTER);
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [txInfo, setTxInfo] = useState<string | null>(null);

  const balBTC = satsToBTC(plan.bal);
  const amtBTC = satsToBTC(plan.amt);
  const remainingSwaps = plan.amt > 0 ? Math.floor(plan.bal / plan.amt) : 0;
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  const netSats = plan.amt - Math.floor((plan.amt * 30) / 10000);

  // minAmountOut for USDCx (6 decimals) — user can adjust slippage
  // Without a live quote, we use 0 as a safe default
  const minAmountOut = 0;

  function withLoading(fn: () => void) {
    setLoading(true);
    setTxInfo(null);
    fn();
  }

  const handlePause = () =>
    withLoading(() =>
      pauseSBTCPlan(
        plan.id,
        ({ txId }) => {
          setTxInfo(txId);
          setLoading(false);
          onRefresh();
        },
        () => setLoading(false)
      )
    );

  const handleResume = () =>
    withLoading(() =>
      resumeSBTCPlan(
        plan.id,
        ({ txId }) => {
          setTxInfo(txId);
          setLoading(false);
          onRefresh();
        },
        () => setLoading(false)
      )
    );

  const handleCancel = () => {
    if (!confirm(`Cancel plan #${plan.id} and refund ${balBTC.toFixed(8)} sBTC?`)) return;
    withLoading(() =>
      cancelSBTCPlan(
        plan.id,
        ({ txId }) => {
          setTxInfo(txId);
          setLoading(false);
          addNotification("Plan cancelled & refunded", "success", "dca-out", 5000, {
            planId: String(plan.id),
            action: "cancelled",
            amount: balBTC.toFixed(8),
          });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification("Failed to cancel plan", "error", "dca-out", 5000);
        }
      )
    );
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositInput);
    if (!amount || btcToSats(amount) < 20) return;
    withLoading(() =>
      depositToSBTCPlan(
        plan.id,
        btcToSats(amount),
        ({ txId }) => {
          setTxInfo(txId);
          setDepositInput("");
          setLoading(false);
          onRefresh();
        },
        () => setLoading(false)
      )
    );
  };

  const handleExecute = () => {
    if (!routerInput.includes(".")) return;
    if (!plan.active) return;
    if (plan.bal < plan.amt) return;
    withLoading(() =>
      executeSBTCPlan(
        plan.id,
        routerInput.trim(),
        minAmountOut,
        ({ txId }) => {
          setTxInfo(txId);
          setLoading(false);
          addNotification("Plan executed! Swap completed", "success", "dca-out", 5000, {
            planId: String(plan.id),
            txId,
            action: "executed",
          });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification("Execution failed", "error", "dca-out", 5000, {
            planId: String(plan.id),
          });
        }
      )
    );
  };

  const statusBadge = !plan.active ? (
    plan.bal > 0 ? (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-100">
        Paused
      </span>
    ) : (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
        Depleted
      </span>
    )
  ) : (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100">
      Active
    </span>
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
            <span className="text-xs font-medium text-gray-400">sBTC</span>
            <span className="text-gray-200">&rarr;</span>
            <span className="text-sm font-semibold text-gray-900" title={plan.token}>
              {shortToken(plan.token)}
            </span>
            {statusBadge}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {blocksToInterval(plan.ivl)} · Plan #{plan.id}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{amtBTC.toFixed(8)} sBTC</p>
          <p className="text-xs text-gray-400">per swap</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-1 text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="flex justify-between text-[11px] text-gray-400 mb-1">
          <span>{balBTC.toFixed(8)} sBTC remaining</span>
          <span>{remainingSwaps} swaps left</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all"
            style={{
              width: `${
                plan.tss + plan.bal > 0
                  ? Math.round((plan.bal / (plan.tss + plan.bal)) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Next execution */}
      <div className="px-4 py-2 flex items-center gap-1.5">
        <Clock size={12} className={canExecuteNow ? "text-teal-500" : "text-gray-300"} />
        <span
          className={`text-[11px] ${canExecuteNow ? "text-teal-600 font-medium" : "text-gray-400"}`}
        >
          {canExecuteNow
            ? "Ready to execute now"
            : plan.leb === 0
              ? "Pending first swap"
              : `Next in ~${blocksLeft} blocks`}
        </span>
        {canExecuteNow && (
          <button
            onClick={() => setExpanded(true)}
            className="ml-auto text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors flex items-center gap-1"
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
              { label: "sBTC Spent", value: satsToBTC(plan.tss).toFixed(8) },
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
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-teal-500" />
                <span className="text-xs font-semibold text-teal-700">Ready to Execute</span>
                <span className="ml-auto text-[11px] text-teal-600 font-medium">
                  0.3% protocol fee
                </span>
              </div>
              <div className="bg-white rounded-lg border border-teal-100 px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-teal-600 font-medium">
                    Net swap: {satsToBTC(netSats).toFixed(8)} sBTC
                  </span>
                  <div className="flex gap-1">
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlippage(s)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          slippage === s
                            ? "bg-teal-500 text-white"
                            : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                        }`}
                      >
                        {s}%
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-400 self-center ml-0.5">slip</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">
                  3-hop: sBTC &rarr; STX &rarr; aeUSDC &rarr; USDCx
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-teal-600 font-medium">Swap Router</label>
                <input
                  type="text"
                  placeholder="SP....swap-router-contract"
                  value={routerInput}
                  onChange={(e) => setRouterInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-teal-200 bg-white text-xs text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExecute}
                  disabled={loading || !routerInput.includes(".")}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                  placeholder="Deposit sBTC"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  step="0.00000001"
                  className="w-full px-3 py-2 pr-14 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  sBTC
                </span>
              </div>
              <button
                onClick={handleDeposit}
                disabled={loading || !depositInput}
                className="px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <PlusCircle size={14} /> Add
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {plan.active ? (
              <button
                onClick={handlePause}
                disabled={loading}
                className="flex-1 py-2 rounded-xl border border-yellow-200 text-yellow-600 hover:bg-yellow-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <Pause size={14} /> Pause
              </button>
            ) : plan.bal >= plan.amt ? (
              <button
                onClick={handleResume}
                disabled={loading}
                className="flex-1 py-2 rounded-xl border border-teal-200 text-teal-600 hover:bg-teal-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <Play size={14} /> Resume
              </button>
            ) : null}
            {(plan.active || plan.bal > 0) && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <Trash2 size={14} /> Cancel & Refund
              </button>
            )}
          </div>

          {txInfo && <p className="text-[11px] text-gray-400 break-all">Tx: {txInfo}</p>}
        </div>
      )}
    </div>
  );
}
