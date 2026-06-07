"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { useTransactions, useUserDCAPlans } from "@/hooks/useMarketData";
import { ArrowLeftRight, Repeat2, Bell, CheckCircle2, X, Sparkles, ArrowRight } from "lucide-react";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  done: boolean;
}

const STORAGE_KEY = "stacksport_welcome_v2_dismissed";

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
  const nextStep = steps.find((s) => !s.done) ?? null;

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
          <div data-testid="welcome-steps" className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(to right, var(--accent-glow), color-mix(in srgb, var(--accent-dim) 5%, transparent))', border: '1px solid var(--accent-glow)' }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div className="flex items-start gap-3">
                <motion.div
                  ref={iconRef}
                  className="w-9 h-9 rounded-lg bg-[#408A71] flex items-center justify-center relative shrink-0"
                  animate={celebrating ? { scale: [1, 1.18, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                  transition={celebrating ? { duration: 0.6, repeat: 2 } : { duration: 0.2 }}
                >
                  <Sparkles size={16} className="text-white" />
                </motion.div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {allDone ? "You're all set!" : nextStep ? `Next: ${nextStep.label}` : "Getting Started"}
                  </h3>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: allDone ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {allDone
                      ? "Every setup action is done."
                      : nextStep
                        ? `${nextStep.description} · ${completedCount}/${steps.length} completed`
                        : `${completedCount}/${steps.length} completed`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                {nextStep && (
                  <Link
                    href={nextStep.href}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: '#060C18' }}
                  >
                    Continue
                    <ArrowRight size={15} />
                  </Link>
                )}
                <button
                  onClick={handleDismiss}
                  aria-label="Dismiss getting started"
                  className="p-2 transition-colors rounded-xl"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className="flex items-start gap-2.5 p-3 rounded-xl transition-all"
                  style={step.done
                    ? { backgroundColor: 'var(--accent-glow)' }
                    : step.id === nextStep?.id
                      ? { backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent)' }
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {step.description}
                      </p>
                      {!step.done && step.id === nextStep?.id && (
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                          Recommended
                        </span>
                      )}
                    </div>
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
