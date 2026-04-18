"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { type DCAPlan, microToSTX, cancelPlan } from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";
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
  const { addNotification } = useNotificationStore();
  const [defaultTab, setDefaultTab] = useState<"overview" | "execute" | "history">("overview");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const balSTX = microToSTX(plan.bal);

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
        addNotification("Plan cancelled & refunded", "success", "dca", 5000,
          { planId: String(plan.id), action: "cancelled", amount: balSTX.toFixed(2), txId });
        onRefresh();
      },
      () => {
        setCancelLoading(false);
        addNotification("Failed to cancel plan", "error", "dca", 5000);
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

      {/* Cancel modal */}
      {cancelOpen && (
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
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{balSTX.toFixed(2)} STX</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelOpen(false)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }}
              >
                Keep Plan
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading}
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
