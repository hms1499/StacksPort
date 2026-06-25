"use client";

import { Dialog } from "radix-ui";
import { X, ArrowUpRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { TxPhase, NextAction } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: { icon: React.ElementType; iconBg: string; iconColor?: string; title: string; subtitle?: string };
  children: React.ReactNode;          // body during `form`
  review?: React.ReactNode;           // inline review block, shown when valid
  submitLabel: string;
  submittingLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  phase: TxPhase;
  txId: string | null;
  statusCopy: { submitted: string; confirmed: string; failed: string; viewOnExplorer: string };
  nextActions?: NextAction[];
}

export default function TxSheet({
  open, onOpenChange, header, children, review,
  submitLabel, submittingLabel, canSubmit, onSubmit,
  phase, txId, statusCopy, nextActions = [],
}: Props) {
  const Icon = header.icon;
  const isDone = phase === "submitted" || phase === "confirmed" || phase === "failed";

  const statusLine =
    phase === "confirmed" ? { text: statusCopy.confirmed, color: "var(--accent)", icon: CheckCircle2 }
    : phase === "failed" ? { text: statusCopy.failed, color: "var(--negative)", icon: XCircle }
    : { text: statusCopy.submitted, color: "var(--text-primary)", icon: CheckCircle2 };
  const StatusIcon = statusLine.icon;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)" }} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 glass-card flex flex-col gap-4 p-5
            inset-x-0 bottom-0 rounded-t-2xl
            sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2
            sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: header.iconBg, color: header.iconColor }}>
                <Icon size={16} />
              </div>
              <div>
                <Dialog.Title className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {header.title}
                </Dialog.Title>
                {header.subtitle && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{header.subtitle}</p>
                )}
              </div>
            </div>
            <Dialog.Close type="button" aria-label="Close">
              <X size={18} style={{ color: "var(--text-muted)" }} />
            </Dialog.Close>
          </div>

          {isDone ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <StatusIcon size={18} style={{ color: statusLine.color }} />
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{statusLine.text}</p>
              </div>
              {txId && (
                <a className="text-xs font-semibold flex items-center gap-1 py-1 -my-1 touch-manipulation"
                   style={{ color: "var(--accent)" }}
                   href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                   target="_blank" rel="noopener noreferrer">
                  {statusCopy.viewOnExplorer} <ArrowUpRight size={11} />
                </a>
              )}
              {nextActions.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {nextActions.map((a) => (
                    <Link key={a.href + a.label} href={a.href}
                          className="block w-full rounded-xl py-2.5 text-sm font-semibold text-center"
                          style={{ background: "var(--accent)", color: "#04130d" }}>
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {children}
              {review}
              <button
                type="button"
                disabled={!canSubmit || phase === "submitting"}
                onClick={onSubmit}
                className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "#04130d" }}
              >
                {phase === "submitting" && <Loader2 size={14} className="animate-spin" />}
                {phase === "submitting" ? submittingLabel : submitLabel}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
