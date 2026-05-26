"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const allDone = completedCount === steps.length;

  // Fire a one-shot celebration the first time the user reaches 4/4.
  // NOTE: must be declared BEFORE any early return — hooks rules.
  const [celebrating, setCelebrating] = useState(false);
  const celebratedRef = useRef(false);
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allDone || celebratedRef.current) return;
    celebratedRef.current = true;
    setCelebrating(true);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      void import("canvas-confetti").then(({ default: confetti }) => {
        const rect = iconRef.current?.getBoundingClientRect();
        const origin = rect
          ? {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            }
          : { x: 0.3, y: 0.25 };
        const colors = ["#408A71", "#FFB547", "#F7931A", "#A78BFA"];
        confetti({
          particleCount: 80,
          spread: 75,
          startVelocity: 38,
          ticks: 180,
          gravity: 0.9,
          scalar: 0.85,
          origin,
          colors,
        });
        setTimeout(() => {
          confetti({
            particleCount: 40,
            spread: 110,
            startVelocity: 28,
            ticks: 160,
            gravity: 0.9,
            scalar: 0.7,
            origin,
            colors,
          });
        }, 220);
      });
    }

    const id = setTimeout(() => setCelebrating(false), 2400);
    return () => clearTimeout(id);
  }, [allDone]);

  if (dismissed || !isConnected) return null;

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
          <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(to right, var(--accent-glow), color-mix(in srgb, var(--accent-dim) 5%, transparent))', border: '1px solid var(--accent-glow)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <motion.div
                  ref={iconRef}
                  className="w-8 h-8 rounded-lg bg-[#408A71] flex items-center justify-center relative"
                  animate={celebrating ? { scale: [1, 1.18, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                  transition={celebrating ? { duration: 0.6, repeat: 2 } : { duration: 0.2 }}
                >
                  <Sparkles size={16} className="text-white" />
                </motion.div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {allDone ? "You're all set!" : "Getting Started"}
                  </h3>
                  <p className="text-xs" style={{ color: allDone ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {allDone
                      ? "Every step done — happy stacking."
                      : `${completedCount}/${steps.length} completed`}
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                    style={step.done
                      ? { backgroundColor: '#408A71', color: '#fff' }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }
                    }
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={step.done ? "done" : "todo"}
                        initial={{ scale: 0, rotate: -45, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18 }}
                        className="flex"
                      >
                        {step.done ? <CheckCircle2 size={14} /> : step.icon}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold transition-all"
                      style={{
                        color: step.done ? 'var(--accent)' : 'var(--text-primary)',
                        textDecorationLine: step.done ? 'line-through' : 'none',
                        textDecorationColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                        opacity: step.done ? 0.85 : 1,
                      }}
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
