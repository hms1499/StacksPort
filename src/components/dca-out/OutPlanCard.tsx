"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pause,
  Play,
  Trash2,
  PlusCircle,
  Zap,
  ChevronDown,
  ChevronUp,
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
import { formatBlocksCountdown } from "@/lib/dca-preview";
import { useNotificationStore } from "@/store/notificationStore";

interface Props {
  plan: DCA_SBTCPlan;
  currentBlock: number;
  onRefresh: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function shortToken(contractId: string): string {
  const known = SBTC_TARGET_TOKENS.find((t) => t.value === contractId);
  if (known) return known.label;
  const name = contractId.split(".")[1] ?? contractId;
  return name.length > 20 ? name.slice(0, 18) + "…" : name;
}

interface RowProps {
  plan: DCA_SBTCPlan;
  currentBlock: number;
  expanded: boolean;
  onToggle: () => void;
  onExecuteShortcut?: () => void;
}

function OutPlanCardRow({ plan, currentBlock, expanded, onToggle, onExecuteShortcut }: RowProps) {
  const balBTC = satsToBTC(plan.bal);
  const amtBTC = satsToBTC(plan.amt);
  const totalSwaps = Math.floor((plan.tss + plan.bal) / Math.max(plan.amt, 1));
  const progressPct = totalSwaps > 0 ? Math.round((plan.tsd / totalSwaps) * 100) : 0;
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;

  const statusDotColor = !plan.active
    ? plan.bal > 0 ? "var(--warning)" : "var(--text-muted)"
    : "var(--positive)";
  const statusLabel = !plan.active ? (plan.bal > 0 ? "Paused" : "Depleted") : "Active";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left p-4 flex flex-col gap-2 hover:brightness-105 transition-all"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>sBTC</span>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {shortToken(plan.token)}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          · {blocksToInterval(plan.ivl)} · #{plan.id}
        </span>
        <span className="ml-auto text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
          {amtBTC.toFixed(8)} sBTC
        </span>
        {expanded ? (
          <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDotColor }} />
          {statusLabel}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
          <div className="gradient-dca-out h-full" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
          {plan.tsd}/{totalSwaps} · {balBTC.toFixed(4)} left
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: canExecuteNow ? "var(--positive)" : "var(--text-muted)" }}>
          {canExecuteNow
            ? "⏱ Ready now"
            : plan.leb === 0 ? "⏱ Pending first swap" : `⏱ Next ${formatBlocksCountdown(blocksLeft)}`}
        </span>
        {canExecuteNow && onExecuteShortcut && (
          <span
            onClick={(e) => { e.stopPropagation(); onExecuteShortcut(); }}
            role="button"
            tabIndex={0}
            className="gradient-dca-out ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white cursor-pointer"
          >
            <Zap size={10} /> Execute
          </span>
        )}
      </div>
    </button>
  );
}

export default function OutPlanCard({ plan, currentBlock, onRefresh, isExpanded, onToggle }: Props) {
  const { addNotification } = useNotificationStore();
  const [depositInput, setDepositInput] = useState("");
  const [routerInput, setRouterInput] = useState(DEFAULT_SBTC_SWAP_ROUTER);
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const balBTC = satsToBTC(plan.bal);
  const netSats = plan.amt - Math.floor((plan.amt * 30) / 10000);
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  const minAmountOut = 1;

  function withLoading(fn: () => void) {
    setLoading(true);
    fn();
  }

  const handlePause = () =>
    withLoading(() =>
      pauseSBTCPlan(plan.id,
        () => { setLoading(false); onRefresh(); },
        () => setLoading(false),
      ),
    );

  const handleResume = () =>
    withLoading(() =>
      resumeSBTCPlan(plan.id,
        () => { setLoading(false); onRefresh(); },
        () => setLoading(false),
      ),
    );

  const confirmCancel = () => {
    setShowCancelModal(false);
    withLoading(() =>
      cancelSBTCPlan(plan.id,
        ({ txId }) => {
          setLoading(false);
          addNotification("Plan cancelled & refunded", "success", "dca-out", 5000,
            { planId: String(plan.id), action: "cancelled", amount: balBTC.toFixed(8), txId });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification("Failed to cancel plan", "error", "dca-out", 5000);
        },
      ),
    );
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositInput);
    if (!amount || btcToSats(amount) < 334) return;
    withLoading(() =>
      depositToSBTCPlan(plan.id, btcToSats(amount),
        () => { setDepositInput(""); setLoading(false); onRefresh(); },
        () => setLoading(false),
      ),
    );
  };

  const handleExecute = () => {
    if (!routerInput.includes(".")) return;
    if (!plan.active || plan.bal < plan.amt) return;
    withLoading(() =>
      executeSBTCPlan(plan.id, routerInput.trim(), minAmountOut,
        ({ txId }) => {
          setLoading(false);
          addNotification("Plan executed! Swap completed", "success", "dca-out", 5000,
            { planId: String(plan.id), txId, action: "executed" });
          onRefresh();
        },
        () => {
          setLoading(false);
          addNotification("Execution failed", "error", "dca-out", 5000, { planId: String(plan.id) });
        },
      ),
    );
  };

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden transition-all hover:brightness-[1.02]"
      style={{ boxShadow: "var(--shadow-card)" }}
      data-plan-id={plan.id}
    >
      <OutPlanCardRow
        plan={plan}
        currentBlock={currentBlock}
        expanded={isExpanded}
        onToggle={onToggle}
        onExecuteShortcut={() => { if (!isExpanded) onToggle(); }}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t p-4 flex flex-col gap-3" style={{ borderColor: "var(--border-subtle)" }}>
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Swaps Done", value: String(plan.tsd) },
                  { label: "sBTC Spent", value: satsToBTC(plan.tss).toFixed(8) },
                  { label: "Block Created", value: String(plan.cat) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-2" style={{ background: "var(--bg-elevated)" }}>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p className="text-xs font-semibold font-data" style={{ color: "var(--text-primary)" }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Target token */}
              <div className="rounded-xl p-3" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Target Token</p>
                <p className="text-xs font-mono break-all" style={{ color: "var(--text-secondary)" }}>{plan.token}</p>
              </div>

              {/* Execute (inline — 3-hop sBTC → STX → aeUSDC → USDCx, no live quote) */}
              {canExecuteNow && (
                <div className="gradient-border-dca-out rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Zap size={13} style={{ color: "var(--dca-out-primary)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ready to Execute</span>
                    <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>0.3% protocol fee</span>
                  </div>
                  <div className="rounded-lg p-2.5 flex flex-col gap-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        Net swap: {satsToBTC(netSats).toFixed(8)} sBTC
                      </span>
                      <div className="flex gap-1">
                        {[0.5, 1, 2].map((s) => (
                          <button
                            key={s}
                            onClick={() => setSlippage(s)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                            style={
                              slippage === s
                                ? { background: "var(--dca-out-primary)", color: "#fff" }
                                : { background: "var(--dca-out-dim)", color: "var(--dca-out-primary)" }
                            }
                          >
                            {s}%
                          </button>
                        ))}
                        <span className="text-[10px] self-center ml-0.5" style={{ color: "var(--text-muted)" }}>slip</span>
                      </div>
                    </div>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      3-hop: sBTC → STX → aeUSDC → USDCx
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Swap Router</label>
                    <input
                      type="text"
                      placeholder="SP….swap-router-contract"
                      value={routerInput}
                      onChange={(e) => setRouterInput(e.target.value)}
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
                    disabled={loading || !routerInput.includes(".")}
                    className="gradient-dca-out px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 self-start"
                  >
                    <Zap size={13} /> {loading ? "Executing…" : "Execute"}
                  </button>
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
                      className="w-full px-3 py-2 pr-14 rounded-xl text-sm focus:outline-none focus:ring-2"
                      style={{
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>
                      sBTC
                    </span>
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={loading || !depositInput}
                    className="gradient-dca-out px-3 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
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
                    className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{ border: "1px solid var(--border-default)", color: "var(--warning)", background: "var(--bg-card)" }}
                  >
                    <Pause size={14} /> Pause
                  </button>
                ) : plan.bal >= plan.amt ? (
                  <button
                    onClick={handleResume}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{ border: "1px solid var(--border-default)", color: "var(--dca-out-primary)", background: "var(--bg-card)" }}
                  >
                    <Play size={14} /> Resume
                  </button>
                ) : null}
                {(plan.active || plan.bal > 0) && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{ border: "1px solid var(--border-default)", color: "var(--negative)", background: "var(--bg-card)" }}
                  >
                    <Trash2 size={14} /> Cancel & Refund
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="rounded-2xl w-[90%] max-w-sm p-6 flex flex-col gap-4"
            style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card-hover)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-elevated)" }}
              >
                <Trash2 size={18} style={{ color: "var(--negative)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cancel & Refund</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Plan #{plan.id}</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Are you sure? You will be refunded{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{balBTC.toFixed(8)} sBTC</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }}
              >
                Keep Plan
              </button>
              <button
                onClick={confirmCancel}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--negative)" }}
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
