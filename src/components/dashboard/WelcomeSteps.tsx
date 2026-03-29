"use client";

import { useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useWalletStore } from "@/store/walletStore";
import { Wallet, ArrowLeftRight, Repeat2, Bell, CheckCircle2, X, Sparkles } from "lucide-react";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  check: () => boolean;
}

const STORAGE_KEY = "stacksport_welcome_dismissed";

export default function WelcomeSteps() {
  const { isConnected } = useWalletStore();
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

  const steps: Step[] = [
    {
      id: "wallet",
      label: "Connect Wallet",
      description: "Link your Stacks wallet",
      icon: <Wallet size={16} />,
      href: "/dashboard",
      check: () => isConnected,
    },
    {
      id: "swap",
      label: "Make a Swap",
      description: "Trade tokens on Bitflow DEX",
      icon: <ArrowLeftRight size={16} />,
      href: "/trade",
      check: () => false,
    },
    {
      id: "dca",
      label: "Create DCA Plan",
      description: "Set up automated investing",
      icon: <Repeat2 size={16} />,
      href: "/dca",
      check: () => false,
    },
    {
      id: "alerts",
      label: "Set Price Alert",
      description: "Get notified on targets",
      icon: <Bell size={16} />,
      href: "/notifications",
      check: () => false,
    },
  ];

  const completedCount = steps.filter((s) => s.check()).length;
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
          <div className="bg-gradient-to-r from-[#408A71]/5 to-[#B0E4CC]/10 dark:from-[#285A48]/20 dark:to-[#285A48]/5 rounded-2xl border border-[#B0E4CC]/30 dark:border-[#285A48]/40 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#408A71] flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Getting Started
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {completedCount}/{steps.length} completed
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-200/50 dark:bg-gray-700/50 rounded-full mb-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full bg-[#408A71] rounded-full"
              />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {steps.map((step) => {
                const done = step.check();
                return (
                  <Link
                    key={step.id}
                    href={step.href}
                    className={`flex items-start gap-2.5 p-3 rounded-xl transition-all ${
                      done
                        ? "bg-[#408A71]/10 dark:bg-[#285A48]/30"
                        : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        done
                          ? "bg-[#408A71] text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {done ? <CheckCircle2 size={14} /> : step.icon}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold ${
                          done ? "text-[#408A71] dark:text-[#B0E4CC]" : "text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
