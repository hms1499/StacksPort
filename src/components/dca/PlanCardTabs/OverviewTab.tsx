"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { type DCAPlan, microToSTX, stxToMicro, depositToPlan, pausePlan, resumePlan } from "@/lib/dca";
import { formatRelativeBlockDate } from "@/lib/dca-preview";
import { useNotificationStore } from "@/store/notificationStore";
import { useWalletStore } from "@/store/walletStore";
import { trackTx } from "@/lib/tx-tracker";

interface OverviewTabProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
  onRequestCancel: () => void; // parent opens cancel modal
}

export default function OverviewTab({ plan, currentBlock, onRefresh, onRequestCancel }: OverviewTabProps) {
  const t = useTranslations("dca.overview");
  const { addNotification } = useNotificationStore();
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const [depositInput, setDepositInput] = useState("");
  const [loading, setLoading] = useState(false);

  const avgStxPerSwap = plan.tsd > 0 ? plan.tss / plan.tsd : 0;
  const stopLoading = () => setLoading(false);

  const handleDeposit = () => {
    const n = parseFloat(depositInput);
    if (!n || n < 1) return;
    setLoading(true);
    depositToPlan(plan.id, stxToMicro(n),
      ({ txId }) => {
        stopLoading(); setDepositInput("");
        addNotification(t("depositedToast", { amount: n, tx: txId.slice(0, 10) }), "success", "dca", 5000);
        trackTx({
          txId,
          label: t("depositTxLabel", { id: plan.id, amount: n }),
          category: "dca",
          context: { planId: String(plan.id), txId, amount: n.toFixed(2) },
          addNotification,
          address: stxAddress,
        });
        onRefresh();
      },
      stopLoading, // user dismissed the wallet — release the spinner silently
    );
  };

  const handlePause = () => {
    setLoading(true);
    pausePlan(plan.id,
      ({ txId }) => {
        stopLoading();
        trackTx({
          txId,
          label: t("pausedTxLabel", { id: plan.id }),
          category: "dca",
          context: { planId: String(plan.id), txId },
          addNotification,
          address: stxAddress,
        });
        onRefresh();
      },
      stopLoading,
    );
  };

  const handleResume = () => {
    setLoading(true);
    resumePlan(plan.id,
      ({ txId }) => {
        stopLoading();
        trackTx({
          txId,
          label: t("resumedTxLabel", { id: plan.id }),
          category: "dca",
          context: { planId: String(plan.id), txId },
          addNotification,
          address: stxAddress,
        });
        onRefresh();
      },
      stopLoading,
    );
  };

  const shortfallStx = !plan.active && plan.bal < plan.amt
    ? microToSTX(plan.amt - plan.bal)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <StatMini label={t("swapsDone")} value={plan.tsd.toString()} />
        <StatMini label={t("stxSpent")} value={microToSTX(plan.tss).toFixed(1)} />
        <StatMini label={t("avgPerSwap")} value={microToSTX(avgStxPerSwap).toFixed(2)} />
        <StatMini label={t("created")} value={formatRelativeBlockDate(currentBlock - plan.cat)} />
      </div>

      {/* Deposit row — active plans get the input; paused plans get a hint */}
      {plan.active ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              placeholder={t("addStx")}
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
            {t("add")}
          </button>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {shortfallStx > 0
            ? t("topUpHint", { amount: shortfallStx.toFixed(2) })
            : t("resumeHint")}
        </p>
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
            <Pause size={14} /> {t("pause")}
          </button>
        ) : plan.bal >= plan.amt ? (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--bg-card)" }}
          >
            <Play size={14} /> {t("resume")}
          </button>
        ) : null}
        {(plan.active || plan.bal > 0) && (
          <button
            onClick={onRequestCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--negative)", color: "var(--negative)", background: "var(--bg-card)" }}
          >
            <Trash2 size={14} /> {t("cancelRefund")}
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
