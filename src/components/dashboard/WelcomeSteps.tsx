"use client";

import { useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useWalletStore } from "@/store/walletStore";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { useTransactions, useUserDCAPlans } from "@/hooks/useMarketData";
import { Wallet, ArrowLeftRight, Repeat2, Bell, CheckCircle2, X, Sparkles } from "lucide-react";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  done: boolean;
}

const STORAGE_KEY = "stacksport_welcome_dismissed";

export default function WelcomeSteps() {
  const { isConnected, stxAddress } = useWalletStore();
  const alerts = usePriceAlertStore((s) => s.alerts);

  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: txData } = useTransactions(addr, 20);
  const { data: dcaPlans } = useUserDCAPlans(addr);

  const isDismissedFromStorage = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => localStorage.getItem(STORAGE_KEY) === "true",
    () => true // server snapshot: default to dismissed to avoid hydration mismatch
  );
  const [dismissed, setDismissed] = useState(isDismissedFromStorage);

  if (dismissed || !isConnected) return null;

  const hasSwapped = (txData?.results ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => (r.tx ?? r).tx_type === "contract_call"
  );
  const hasDCAPlans = (dcaPlans?.length ?? 0) > 0;
  const hasAlerts = alerts.length > 0;

  const steps: Step[] = [
    {
      id: "wallet",
      label: "Connect Wallet",
      description: "Link your Stacks wallet",
      icon: <Wallet size={16} />,
      href: "/dashboard",
      done: isConnected,
    },
    {
      id: "swap",
      label: "Make a Swap",
      description: "Trade tokens on Bitflow DEX",
      icon: <ArrowLeftRight size={16} />,
      href: "/trade",
      done: hasSwapped,
    },
    {
      id: "dca",
      label: "Create DCA Plan",
      description: "Set up automated investing",
      icon: <Repeat2 size={16} />,
      href: "/dca",
      done: hasDCAPlans,
    },
    {
      id: "alerts",
      label: "Set Price Alert",
      description: "Get notified on targets",
      icon: <Bell size={16} />,
      href: "/notifications",
      done: hasAlerts,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(to right, var(--accent-glow), color-mix(in srgb, var(--accent-dim) 5%, transparent))', border: '1px solid var(--accent-glow)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#408A71] flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Getting Started
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {completedCount}/{steps.length} completed
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full bg-[#408A71] rounded-full"
              />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className="flex items-start gap-2.5 p-3 rounded-xl transition-all"
                  style={step.done
                    ? { backgroundColor: 'var(--accent-glow)' }
                    : { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }
                  }
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={step.done
                      ? { backgroundColor: '#408A71', color: '#fff' }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }
                    }
                  >
                    {step.done ? <CheckCircle2 size={14} /> : step.icon}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: step.done ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {step.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
