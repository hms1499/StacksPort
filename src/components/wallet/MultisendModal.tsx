"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { openSTXTransfer } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Recipient {
  id: string;
  address: string;
  amount: string;
}

type RowStatus = "idle" | "pending" | "success" | "error";

interface RowResult {
  txId?: string;
  error?: string;
}

interface Props {
  rawStxBalance: string;
  onClose: () => void;
}

const MAX_RECIPIENTS = 20;

function uid() {
  return Math.random().toString(36).slice(2);
}

function toMicro(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount) * 1_000_000));
}

function humanBalance(raw: string): string {
  return (Number(raw) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export default function MultisendModal({ rawStxBalance, onClose }: Props) {
  const { network } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: uid(), address: "", amount: "" },
    { id: uid(), address: "", amount: "" },
  ]);

  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [rowResults, setRowResults] = useState<Record<string, RowResult>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const prefix = network === "mainnet" ? "SP" : "ST";
  const maxSTX = Number(rawStxBalance) / 1_000_000;

  // ── Recipient management ─────────────────────────────────────────────────

  function addRow() {
    if (recipients.length >= MAX_RECIPIENTS) return;
    setRecipients((prev) => [...prev, { id: uid(), address: "", amount: "" }]);
  }

  function removeRow(id: string) {
    if (recipients.length <= 1) return;
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: "address" | "amount", value: string) {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  // ── Validation ───────────────────────────────────────────────────────────

  function validateRows(): string | null {
    const totalSTX = recipients.reduce((sum, r) => {
      const n = parseFloat(r.amount);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);

    for (const r of recipients) {
      if (!r.address.startsWith(prefix) || r.address.length < 30)
        return `Invalid address: ${r.address || "(empty)"}`;
      const n = parseFloat(r.amount);
      if (isNaN(n) || n <= 0) return "All amounts must be greater than 0";
    }

    if (totalSTX > maxSTX)
      return `Total ${totalSTX.toFixed(6)} STX exceeds balance ${maxSTX.toFixed(6)} STX`;

    return null;
  }

  const totalSTX = recipients.reduce((sum, r) => {
    const n = parseFloat(r.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // ── Execution ────────────────────────────────────────────────────────────

  async function handleSend() {
    setGlobalError(null);
    const err = validateRows();
    if (err) { setGlobalError(err); return; }

    setIsRunning(true);

    // initialise all rows as pending
    const initStatuses: Record<string, RowStatus> = {};
    recipients.forEach((r) => { initStatuses[r.id] = "pending"; });
    setRowStatuses(initStatuses);

    let successCount = 0;
    let failCount = 0;

    for (const r of recipients) {
      await new Promise<void>((resolve) => {
        openSTXTransfer({
          recipient: r.address,
          amount: toMicro(r.amount),
          memo: "",
          network,
          onFinish: ({ txId }) => {
            setRowStatuses((prev) => ({ ...prev, [r.id]: "success" }));
            setRowResults((prev) => ({ ...prev, [r.id]: { txId } }));
            successCount++;
            resolve();
          },
          onCancel: () => {
            setRowStatuses((prev) => ({ ...prev, [r.id]: "error" }));
            setRowResults((prev) => ({
              ...prev,
              [r.id]: { error: "Cancelled" },
            }));
            failCount++;
            resolve();
          },
        });
      });
    }

    setIsRunning(false);
    setIsDone(true);

    addNotification(
      `Multi-send complete: ${successCount} success, ${failCount} failed`,
      failCount > 0 ? "warning" : "success",
      "send",
      6000
    );
  }

  // ── Status icon ──────────────────────────────────────────────────────────

  function StatusIcon({ id }: { id: string }) {
    const s = rowStatuses[id];
    if (!s || s === "idle") return null;
    if (s === "pending") return <Loader2 size={14} className="animate-spin text-[#408A71] shrink-0" />;
    if (s === "success") return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
    return <XCircle size={14} className="text-red-400 shrink-0" />;
  }

  // ── Done screen ──────────────────────────────────────────────────────────

  if (isDone) {
    const successIds = recipients.filter((r) => rowStatuses[r.id] === "success");
    const failIds    = recipients.filter((r) => rowStatuses[r.id] === "error");

    return (
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-md gap-0 rounded-2xl bg-popover p-6 max-h-[85vh] flex flex-col">
          <DialogHeader className="mb-4 space-y-0 text-left">
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Multi-Send Complete</DialogTitle>
            <DialogDescription className="sr-only">Summary of your multi-send transaction results</DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 mb-5">
            <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{successIds.length}</p>
              <p className="text-xs text-green-600 mt-0.5">Successful</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{failIds.length}</p>
              <p className="text-xs text-red-500 mt-0.5">Failed / Cancelled</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-2">
            {recipients.map((r) => {
              const result = rowResults[r.id];
              const success = rowStatuses[r.id] === "success";
              return (
                <div key={r.id} className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  {success
                    ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{r.address}</p>
                    <p style={{ color: 'var(--text-muted)' }}>{r.amount} STX</p>
                    {success && result?.txId && (
                      <a
                        href={`https://explorer.hiro.so/txid/${result.txId}?chain=${network}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline break-all"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        {result.txId.slice(0, 20)}...
                      </a>
                    )}
                    {!success && result?.error && (
                      <p className="text-red-400">{result.error}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2.5 rounded-xl text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-dim)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)')}
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !isRunning) onClose(); }}>
      <DialogContent showCloseButton={!isRunning} className="max-w-lg gap-0 rounded-2xl bg-popover p-6 max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="mb-5 flex-row items-center gap-2 space-y-0 text-left">
          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
            <ArrowUpRight size={16} className="text-orange-500" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Multi-Send STX</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--text-muted)' }}>Balance: {humanBalance(rawStxBalance)} STX</DialogDescription>
          </div>
        </DialogHeader>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_140px_32px] gap-2 mb-2 px-1">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Recipient Address</p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Amount (STX)</p>
          <span />
        </div>

        {/* Recipient rows */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {recipients.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder={`${prefix}...`}
                  value={r.address}
                  onChange={(e) => updateRow(r.id, "address", e.target.value.trim())}
                  disabled={isRunning}
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#B0E4CC] placeholder:text-gray-400 disabled:opacity-60 pr-6"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <StatusIcon id={r.id} />
                </div>
              </div>

              <input
                type="number"
                placeholder="0.00"
                min="0"
                step="any"
                value={r.amount}
                onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#B0E4CC] placeholder:text-gray-400 disabled:opacity-60"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />

              <button
                onClick={() => removeRow(r.id)}
                disabled={recipients.length <= 1 || isRunning}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--border-default)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        {!isRunning && recipients.length < MAX_RECIPIENTS && (
          <button
            onClick={addRow}
            className="mt-3 flex items-center gap-1.5 text-xs text-[#408A71] hover:text-[#285A48] font-medium"
          >
            <Plus size={13} />
            Add recipient ({recipients.length}/{MAX_RECIPIENTS})
          </button>
        )}

        {/* Summary */}
        <div className="mt-4 px-3 py-2.5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              {recipients.length} transaction{recipients.length > 1 ? "s" : ""} · approve each in wallet
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Total sending</span>
            <span className={`font-semibold ${totalSTX > maxSTX ? "text-red-500" : ""}`} style={totalSTX > maxSTX ? undefined : { color: 'var(--text-primary)' }}>
              {totalSTX.toFixed(6)} STX
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Remaining balance</span>
            <span className={`font-semibold ${maxSTX - totalSTX < 0 ? "text-red-500" : ""}`} style={maxSTX - totalSTX < 0 ? undefined : { color: 'var(--accent-text)' }}>
              {(maxSTX - totalSTX).toFixed(6)} STX
            </span>
          </div>
        </div>

        {/* Error */}
        {globalError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={13} />
            {globalError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSend}
          disabled={isRunning || totalSTX === 0}
          className="mt-4 w-full py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent)' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-dim)'; }}
          onMouseLeave={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
        >
          {isRunning ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Sending... approve each transaction
            </>
          ) : (
            <>
              <ArrowUpRight size={15} />
              Send to {recipients.length} address{recipients.length > 1 ? "es" : ""}
            </>
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
