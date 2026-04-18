"use client";

import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { type DCAPlan, microToSTX, blocksToInterval, TARGET_TOKENS } from "@/lib/dca";
import { formatBlocksCountdown } from "@/lib/dca-preview";

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
  const balSTX = microToSTX(plan.bal);
  const amtSTX = microToSTX(plan.amt);
  const totalSwaps = Math.floor((plan.tss + plan.bal) / Math.max(plan.amt, 1));
  const progressPct = totalSwaps > 0 ? Math.round((plan.tsd / totalSwaps) * 100) : 0;
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;

  const statusDotColor = !plan.active
    ? plan.bal > 0 ? "var(--warning)" : "var(--text-muted)"
    : "var(--positive)";
  const statusLabel = !plan.active
    ? plan.bal > 0 ? "Paused" : "Depleted"
    : "Active";

  const progressClass = mode === "in" ? "gradient-dca-in" : "gradient-dca-out";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left p-4 flex flex-col gap-2 hover:brightness-105 transition-all"
      aria-expanded={expanded}
    >
      {/* Line 1: token pair + id + amount + chevron */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {shortToken(plan.token)}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          · {blocksToInterval(plan.ivl)} · #{plan.id}
        </span>
        <span className="ml-auto text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
          {amtSTX.toFixed(2)} STX
        </span>
        {expanded ? (
          <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        )}
      </div>

      {/* Line 2: status + progress bar + counts */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDotColor }} />
          {statusLabel}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
          <div className={`${progressClass} h-full`} style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
          {plan.tsd}/{totalSwaps} · {balSTX.toFixed(1)} STX left
        </span>
      </div>

      {/* Line 3: next-swap + optional execute shortcut */}
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: canExecuteNow ? "var(--positive)" : "var(--text-muted)" }}>
          {canExecuteNow
            ? "⏱ Ready now"
            : plan.leb === 0 ? "⏱ Pending first swap" : `⏱ Next ${formatBlocksCountdown(blocksLeft)}`}
        </span>
        {canExecuteNow && onExecuteShortcut && (
          <span
            onClick={(e) => { e.stopPropagation(); onExecuteShortcut(); }}
            role="button"
            tabIndex={0}
            className={`${mode === "in" ? "gradient-dca-in" : "gradient-dca-out"} ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white cursor-pointer`}
          >
            <Zap size={10} /> Execute
          </span>
        )}
      </div>
    </button>
  );
}
