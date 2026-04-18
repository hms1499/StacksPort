"use client";

import { Info, AlertTriangle } from "lucide-react";
import { INTERVALS } from "@/lib/dca";
import {
  swapsCount,
  estimateEndDate,
  totalProtocolFee,
} from "@/lib/dca-preview";

type Mode = "in" | "out";

interface LivePreviewCardProps {
  mode: Mode;
  amountStx: number;       // for "in": STX per swap; for "out": sBTC per swap (reuse unit-agnostic calc)
  depositStx: number;      // initial deposit
  intervalKey: keyof typeof INTERVALS;
  estimatedOutput: number | null;  // sBTC (in-mode) or USDCx (out-mode), or null when not quoted
  outputLabel: string;             // e.g. "sBTC" or "USDCx"
  inputLabel: string;              // e.g. "STX" or "sBTC"
  invalidReason?: string | null;   // if set, render as warning card
}

export default function LivePreviewCard({
  mode,
  amountStx,
  depositStx,
  intervalKey,
  estimatedOutput,
  outputLabel,
  inputLabel,
  invalidReason,
}: LivePreviewCardProps) {
  const swaps = swapsCount(depositStx, amountStx);
  const endDate = estimateEndDate(depositStx, amountStx, intervalKey);
  const fee = totalProtocolFee(depositStx, amountStx);

  if (invalidReason) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-2"
        style={{ border: `1px solid var(--warning)`, background: "var(--bg-elevated)" }}
      >
        <AlertTriangle size={14} style={{ color: "var(--warning)" }} className="mt-0.5 shrink-0" />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{invalidReason}</p>
      </div>
    );
  }

  if (swaps <= 0) return null;

  const borderClass = mode === "in" ? "gradient-border-dca-in" : "gradient-border-dca-out";

  return (
    <div className={`${borderClass} rounded-2xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-1.5">
        <Info size={12} style={{ color: "var(--text-muted)" }} />
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Live Preview
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Swaps</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {swaps} × {amountStx.toFixed(2)} {inputLabel}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Ends ~</p>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Est. output</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {estimatedOutput != null ? `~${estimatedOutput.toFixed(outputLabel === "sBTC" ? 8 : 2)} ${outputLabel}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total fee</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {fee.toFixed(2)} {inputLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
