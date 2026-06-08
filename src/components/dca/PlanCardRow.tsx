"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { type DCAPlan, microToSTX, blocksToInterval, TARGET_TOKENS } from "@/lib/dca";
import { formatBlocksCountdown, formatRelativeBlockDate } from "@/lib/dca-preview";

// Nakamoto Stacks: ~6.5 blocks/min (~9.2 s/block). Must stay in sync with
// INTERVALS in src/lib/dca.ts (Daily=650 blocks ≈ 1.7 h).
const STACKS_BLOCK_SECONDS = 9.2;

function formatAbsoluteTime(blocksLeft: number): string | null {
  if (blocksLeft <= 0) return null;
  const ts = Date.now() + blocksLeft * STACKS_BLOCK_SECONDS * 1000;
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const within7d = ts - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (within7d) {
    return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface PlanCardRowProps {
  plan: DCAPlan;
  currentBlock: number;
  expanded: boolean;
  onToggle: () => void;
  onExecuteShortcut?: () => void; // optional — opens expanded + focuses execute tab
  mode?: "in" | "out";
}

function shortToken(contractId: string): string {
  const known = TARGET_TOKENS.find((t) => t.value === contractId);
  if (known) return known.label;
  const name = contractId.split(".")[1] ?? contractId;
  return name.length > 20 ? name.slice(0, 18) + "…" : name;
}

export default function PlanCardRow({
  plan,
  currentBlock,
  expanded,
  onToggle,
  onExecuteShortcut,
  mode = "in",
}: PlanCardRowProps) {
  const t = useTranslations("dca.card");
  const ti = useTranslations("dca.interval");
  const balSTX = microToSTX(plan.bal);
  const amtSTX = microToSTX(plan.amt);
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  const swapsRemaining = plan.amt > 0 ? Math.floor(plan.bal / plan.amt) : 0;
  const lowBalance = plan.active && swapsRemaining > 0 && swapsRemaining <= 2;
  const absoluteTime = formatAbsoluteTime(blocksLeft);

  const statusDotColor = !plan.active
    ? plan.bal > 0 ? "var(--warning)" : "var(--text-muted)"
    : "var(--positive)";
  const statusLabel = !plan.active
    ? plan.bal > 0 ? t("statusPaused") : t("statusDepleted")
    : t("statusActive");

  const intervalRaw = blocksToInterval(plan.ivl);
  const intervalLabel = (["Daily", "Weekly", "Monthly"] as const).includes(
    intervalRaw as "Daily" | "Weekly" | "Monthly",
  )
    ? ti(intervalRaw)
    : intervalRaw;

  return (
    <div
      onClick={onToggle}
      className="w-full text-left p-4 flex flex-col gap-2 hover:brightness-105 transition-all cursor-pointer"
    >
      {/* Line 1: token pair + id + amount + chevron */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {shortToken(plan.token)}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
          title={t("planNumber", { id: plan.id })}
        >
          · {intervalLabel} · {formatRelativeBlockDate(currentBlock - plan.cat)}
        </span>
        <span className="ml-auto text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
          {amtSTX.toFixed(2)} STX
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-expanded={expanded}
          aria-label={expanded ? t("collapseAria") : t("expandAria")}
          className="rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ color: "var(--text-muted)" }}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Line 2: status + progress bar + counts */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDotColor }} />
          {statusLabel}
        </span>
        <span
          className="ml-auto text-[11px] font-data"
          style={{ color: "var(--text-muted)" }}
          title={t("summaryTitle")}
        >
          {t("summary", { done: plan.tsd, affordable: swapsRemaining, left: balSTX.toFixed(1) })}
        </span>
      </div>

      {/* Line 3: next-swap + optional execute shortcut */}
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: canExecuteNow ? "var(--positive)" : "var(--text-muted)" }}>
          {canExecuteNow
            ? t("readyNow")
            : plan.leb === 0
              ? t("pendingFirst")
              : (
                <>
                  {absoluteTime && (
                    <span className="font-data" style={{ color: "var(--text-secondary)" }}>
                      ⏱ {absoluteTime}
                    </span>
                  )}
                  {absoluteTime && <span className="mx-1">·</span>}
                  ~{formatBlocksCountdown(blocksLeft)}
                </>
              )}
        </span>
        {lowBalance && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--warning) 14%, transparent)",
              color: "var(--warning)",
              border: "1px solid color-mix(in srgb, var(--warning) 28%, transparent)",
            }}
            title={t("lowBalanceTitle", { count: swapsRemaining })}
          >
            <AlertTriangle size={10} />
            {t("swapsLeft", { count: swapsRemaining })}
          </span>
        )}
        {canExecuteNow && onExecuteShortcut && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExecuteShortcut(); }}
            className={`${mode === "in" ? "gradient-dca-in" : "gradient-dca-out"} ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-1`}
          >
            <Zap size={10} /> {t("execute")}
          </button>
        )}
      </div>
    </div>
  );
}
