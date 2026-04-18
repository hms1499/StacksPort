"use client";

import { useState } from "react";
import { Pause, Play, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { type DCAPlan, microToSTX, stxToMicro, depositToPlan, pausePlan, resumePlan } from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";
import MiniSparkline from "../MiniSparkline";

interface OverviewTabProps {
  plan: DCAPlan;
  onRefresh: () => void;
  onRequestCancel: () => void; // parent opens cancel modal
}

export default function OverviewTab({ plan, onRefresh, onRequestCancel }: OverviewTabProps) {
  const { addNotification } = useNotificationStore();
  const [depositInput, setDepositInput] = useState("");
  const [loading, setLoading] = useState(false);

  const avgOutput = plan.tsd > 0 ? plan.tss / plan.tsd : 0; // avg uSTX per swap (rough)

  const run = (fn: () => void) => { setLoading(true); fn(); };

  const handleDeposit = () => {
    const n = parseFloat(depositInput);
    if (!n || n < 1) return;
    run(() =>
      depositToPlan(plan.id, stxToMicro(n),
        ({ txId }) => {
          setLoading(false); setDepositInput("");
          addNotification(`Deposited ${n} STX (tx ${txId.slice(0,10)}…)`, "success", "dca", 5000);
          onRefresh();
        },
        () => { setLoading(false); addNotification("Deposit failed", "error", "dca", 5000); },
      ),
    );
  };

  const handlePause = () =>
    run(() => pausePlan(plan.id,
      () => { setLoading(false); onRefresh(); },
      () => { setLoading(false); addNotification("Pause failed", "error", "dca", 5000); },
    ));

  const handleResume = () =>
    run(() => resumePlan(plan.id,
      () => { setLoading(false); onRefresh(); },
      () => { setLoading(false); addNotification("Resume failed", "error", "dca", 5000); },
    ));

  return (
    <div className="flex flex-col gap-3">
      {/* Stats + sparkline row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid grid-cols-2 gap-2">
          <StatMini label="Swaps done" value={plan.tsd.toString()} />
          <StatMini label="STX spent" value={microToSTX(plan.tss).toFixed(1)} />
          <StatMini label="Avg / swap" value={`${microToSTX(avgOutput).toFixed(2)} STX`} />
          <StatMini label="Block created" value={plan.cat.toString()} />
        </div>
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            sBTC price (7d)
          </p>
          <MiniSparkline />
        </div>
      </div>

      {/* Deposit row */}
      {plan.active && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              placeholder="Add STX"
              className="w-full px-3 py-2 pr-12 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>STX</span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={loading || !depositInput}
            className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Add
          </button>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {plan.active ? (
          <button
            onClick={handlePause}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--warning)", color: "var(--warning)", background: "var(--bg-card)" }}
          >
            <Pause size={14} /> Pause
          </button>
        ) : plan.bal >= plan.amt ? (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--bg-card)" }}
          >
            <Play size={14} /> Resume
          </button>
        ) : null}
        {(plan.active || plan.bal > 0) && (
          <button
            onClick={onRequestCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--negative)", color: "var(--negative)", background: "var(--bg-card)" }}
          >
            <Trash2 size={14} /> Cancel & Refund
          </button>
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-2" style={{ background: "var(--bg-elevated)" }}>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xs font-semibold font-data" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
