"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Wallet, Bitcoin, Coins, ArrowUpRight } from "lucide-react";
import { formatUSD } from "@/lib/utils";

interface Chip {
  key: string;
  label: string;
  usd: number;
  color: string;
  icon: typeof Wallet;
  href: string;
}

interface Props {
  stxUsd: number;
  otherUsd: number;
  totalUsd: number;
  /** Click to dismiss — typically toggles parent state. */
  onDismiss?: () => void;
}

export default function PortfolioBreakdown({ stxUsd, otherUsd, totalUsd, onDismiss }: Props) {
  const chips: Chip[] = [
    { key: "stx",   label: "STX",            usd: stxUsd,   color: "#00C27A", icon: Wallet,  href: "/assets" },
    { key: "sbtc",  label: "sBTC & Tokens",  usd: otherUsd, color: "#F7931A", icon: Bitcoin, href: "/assets" },
  ];

  // Add a placeholder "Stacking" / "DCA" chip if data is wired later.
  const visible = chips.filter((c) => c.usd > 0);
  if (visible.length === 0) {
    visible.push({ key: "empty", label: "All assets", usd: 0, color: "#6366F1", icon: Coins, href: "/assets" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div
        className="mt-4 pt-4"
        style={{ borderTop: "1px dashed var(--border-default)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            Breakdown
          </span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-[10px] font-semibold tracking-wider uppercase transition-colors"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
            >
              Collapse
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {visible.map((chip, i) => {
            const pct = totalUsd > 0 ? (chip.usd / totalUsd) * 100 : 0;
            const Icon = chip.icon;
            return (
              <motion.div
                key={chip.key}
                initial={{
                  opacity: 0,
                  scale: 0.4,
                  x: (Math.random() - 0.5) * 60,
                  y: -20 + (Math.random() - 0.5) * 30,
                }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 22,
                  delay: i * 0.06,
                }}
              >
                <Link
                  href={chip.href}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all group"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${chip.color} 9%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${chip.color} 18%, transparent)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      `color-mix(in srgb, ${chip.color} 14%, transparent)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      `color-mix(in srgb, ${chip.color} 9%, transparent)`;
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${chip.color} 22%, transparent)` }}
                  >
                    <Icon size={16} style={{ color: chip.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {chip.label}
                    </p>
                    <p className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
                      {formatUSD(chip.usd)} · {pct.toFixed(0)}%
                    </p>
                  </div>
                  <ArrowUpRight
                    size={13}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    style={{ color: chip.color }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
