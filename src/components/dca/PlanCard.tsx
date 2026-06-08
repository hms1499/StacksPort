"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { type DCAPlan, microToSTX, cancelPlan } from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";
import { useWalletStore } from "@/store/walletStore";
import { trackTx } from "@/lib/tx-tracker";
import PlanCardRow from "./PlanCardRow";
import PlanCardExpanded from "./PlanCardExpanded";

interface Props {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PlanCard({ plan, currentBlock, onRefresh, isExpanded, onToggle }: Props) {
  const t = useTranslations("dca.card");
  const { addNotification } = useNotificationStore();
  const { stxAddress } = useWalletStore();
  const [defaultTab, setDefaultTab] = useState<"overview" | "execute" | "history">("overview");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const balSTX = microToSTX(plan.bal);
  const keepBtnRef = useRef<HTMLButtonElement | null>(null);

  // Modal a11y: Escape closes, body scroll locks, focus moves to safe action.
  useEffect(() => {
    if (!cancelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cancelLoading) setCancelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the safe "Keep Plan" button rather than the destructive one.
    requestAnimationFrame(() => keepBtnRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [cancelOpen, cancelLoading]);

  const handleExecuteShortcut = () => {
    setDefaultTab("execute");
    if (!isExpanded) onToggle();
  };

  const confirmCancel = () => {
    setCancelOpen(false);
    setCancelLoading(true);
    cancelPlan(plan.id,
      ({ txId }) => {
        setCancelLoading(false);
        addNotification(t("cancelSubmitted"), "info", "dca", 5000,
          { planId: String(plan.id), action: "cancelled", amount: balSTX.toFixed(2), txId });
        trackTx({
          txId,
          label: t("cancelTxLabel", { id: plan.id }),
          category: "dca",
          context: { planId: String(plan.id), txId, amount: balSTX.toFixed(2) },
          addNotification,
          address: stxAddress,
        });
        onRefresh();
      },
      () => {
        setCancelLoading(false);
        addNotification(t("cancelFailed"), "error", "dca", 5000);
      },
    );
  };

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden transition-all hover:brightness-[1.02]"
      style={{ boxShadow: "var(--shadow-card)" }}
      data-plan-id={plan.id}
    >
      <PlanCardRow
        plan={plan}
        currentBlock={currentBlock}
        expanded={isExpanded}
        onToggle={onToggle}
        onExecuteShortcut={handleExecuteShortcut}
        mode="in"
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
            <PlanCardExpanded
              plan={plan}
              currentBlock={currentBlock}
              onRefresh={onRefresh}
              onRequestCancel={() => setCancelOpen(true)}
              defaultTab={defaultTab}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {cancelOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!cancelLoading) setCancelOpen(false); }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`cancel-plan-${plan.id}-title`}
            onClick={(e) => e.stopPropagation()}
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
                <h3 id={`cancel-plan-${plan.id}-title`} className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("cancelRefund")}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("planNumber", { id: plan.id })}</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t.rich("cancelConfirm", {
                amount: balSTX.toFixed(2),
                b: (chunks) => (
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{chunks}</span>
                ),
              })}
            </p>
            <div className="flex gap-2">
              <button
                ref={keepBtnRef}
                onClick={() => setCancelOpen(false)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 focus:outline-none focus:ring-2"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }}
              >
                {t("keepPlan")}
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 focus:outline-none focus:ring-2"
                style={{ background: "var(--negative)" }}
              >
                {t("cancelRefund")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
