"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSTXMarketStats, useSTXPriceHistory } from "@/hooks/useMarketData";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";
import { dropdown, dropdownTransition } from "@/lib/animations";

function MiniChart({ prices, positive }: { prices: number[]; positive: boolean }) {
  const width = 180;
  const height = 48;
  const padding = 2;

  if (prices.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const color = positive ? "var(--positive)" : "var(--negative)";

  const coords = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * (width - padding * 2) + padding,
    y: ((max - p) / range) * (height - padding * 2) + padding,
  }));

  const pathD = coords
    .map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`))
    .join(" ");

  const areaD = `${pathD} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  const gradId = positive ? "stx-pop-g" : "stx-pop-r";

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function STXChip() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useSTXMarketStats();
  const priceFlash = useFlashOnChange(stats?.price);

  // Only fetch history once popover opens
  const { data: history } = useSTXPriceHistory(1, open);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!stats) return null;

  const positive = stats.change24h >= 0;
  const prices = history?.map((p) => p.value) ?? [];
  const high = prices.length ? Math.max(...prices) : null;
  const low = prices.length ? Math.min(...prices) : null;

  return (
    <div ref={wrapRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Open STX price details"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-data transition-colors duration-150"
        style={{
          backgroundColor: open ? 'var(--border-subtle)' : 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span
          className="font-bold uppercase tracking-wider text-[10px]"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          STX
        </span>
        <span className={`font-semibold ${priceFlash}`} style={{ color: 'var(--text-primary)' }}>
          ${stats.price.toFixed(4)}
        </span>
        <span
          className="flex items-center gap-0.5 font-semibold"
          style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
        >
          {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(stats.change24h).toFixed(1)}%
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdown}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={dropdownTransition}
            role="dialog"
            className="absolute left-0 mt-2 w-64 rounded-2xl shadow-2xl z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div className="p-3.5">
              <div className="flex items-baseline justify-between mb-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                >
                  Stacks · STX
                </span>
                <span
                  className="flex items-center gap-0.5 text-xs font-semibold font-data"
                  style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(stats.change24h).toFixed(2)}%
                </span>
              </div>

              <div
                className={`text-2xl font-bold font-data ${priceFlash}`}
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                ${stats.price.toFixed(4)}
              </div>

              <div className="mt-3 -mx-1">
                <MiniChart prices={prices} positive={positive} />
              </div>

              <div
                className="mt-3 grid grid-cols-2 gap-2 pt-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    24h High
                  </p>
                  <p className="text-xs font-semibold font-data" style={{ color: 'var(--text-primary)' }}>
                    {high !== null ? `$${high.toFixed(4)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    24h Low
                  </p>
                  <p className="text-xs font-semibold font-data" style={{ color: 'var(--text-primary)' }}>
                    {low !== null ? `$${low.toFixed(4)}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/assets"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--border-subtle)]"
              style={{
                color: 'var(--accent-text)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              View in Assets
              <ArrowUpRight size={13} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
