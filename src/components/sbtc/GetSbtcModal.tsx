// src/components/sbtc/GetSbtcModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Bitcoin, ArrowUpRight } from "lucide-react";
import { request } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import {
  buildDepositParams,
  validateDepositAmount,
  DEFAULT_MAX_SIGNER_FEE_SATS,
} from "@/lib/sbtc-deposit";
import { useSbtcDeposits } from "@/hooks/useSbtcDeposits";

type Step = "amount" | "review" | "track";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function GetSbtcModal({ open, onOpenChange }: Props) {
  const t = useTranslations("sbtc");
  const { stxAddress, btcPublicKey } = useWalletStore();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<number>(0);
  const [deposit, setDeposit] = useState<{
    address: string;
    depositScript: string;
    reclaimScript: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { deposits } = useSbtcDeposits(stxAddress ?? undefined);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) {
      setStep("amount");
      setAmount(0);
      setDeposit(null);
      setBusy(false);
      setTxid(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const check = validateDepositAmount(amount);

  async function goReview() {
    if (busy) return;
    if (!stxAddress || !btcPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const d = await buildDepositParams({
        stacksAddress: stxAddress,
        reclaimPublicKey: btcPublicKey,
      });
      setDeposit(d);
      setStep("review");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function signAndSend() {
    if (!deposit || !stxAddress) return;
    setBusy(true);
    try {
      setError(null);
      const res = await request("sendTransfer", {
        recipients: [{ address: deposit.address, amount: String(amount) }],
      });
      // Defensive extraction: @stacks/connect may return { txid } or { result: { txid } }
      const resolvedTxid =
        (res as { txid?: string } | null)?.txid ??
        (res as { result?: { txid?: string } } | null)?.result?.txid;

      if (!resolvedTxid) {
        // No txid in response — do not POST or advance; surface nothing (no crash).
        return;
      }

      await fetch("/api/sbtc/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          txid: resolvedTxid,
          stacksAddress: stxAddress,
          amountSats: amount,
          depositScript: deposit.depositScript,
          reclaimScript: deposit.reclaimScript,
        }),
      });

      setTxid(resolvedTxid);
      setStep("track");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="glass-card rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4"
        style={{ boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(247, 147, 26, 0.14)" }}
            >
              <Bitcoin size={16} style={{ color: "#F7931A" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("modalTitle")}
              </p>
              {/* Step indicator */}
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {step === "amount"
                  ? t("stepAmount")
                  : step === "review"
                  ? t("stepReview")
                  : t("stepTrack")}
              </p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} aria-label={t("close")}>
            <X size={18} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* No wallet guard */}
        {!stxAddress ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("noWallet")}
          </p>
        ) : !btcPublicKey ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("unsupported")}
          </p>
        ) : step === "amount" ? (
          /* ── Step 1: Amount ── */
          <>
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {t("amountLabel")}
              </label>
              <input
                inputMode="numeric"
                value={amount || ""}
                onChange={(e) => {
                  setAmount(Math.floor(Number(e.target.value)));
                  setError(null);
                }}
                placeholder="0"
                className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              {amount > 0 && !check.ok && check.reason === "below_min" && (
                <p className="text-[11px]" style={{ color: "#ef4444" }}>
                  {t("belowMin", { min: check.minSats })}
                </p>
              )}
            </div>

            {amount > 0 && (
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p>
                  {t("signerFee")}:{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {DEFAULT_MAX_SIGNER_FEE_SATS.toLocaleString()} sats
                  </span>
                </p>
                <p style={{ color: "var(--text-primary)" }}>
                  {t("youReceive")}{" "}
                  {Math.max(0, amount - DEFAULT_MAX_SIGNER_FEE_SATS).toLocaleString()} sats
                </p>
              </div>
            )}

            {error && (
              <p className="text-[11px]" style={{ color: "#ef4444" }}>{error}</p>
            )}

            <button
              disabled={!check.ok || busy}
              onClick={goReview}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {busy ? t("broadcasting") : t("stepReview")}
            </button>
          </>
        ) : step === "review" ? (
          /* ── Step 2: Review ── */
          <>
            <div className="flex flex-col gap-2">
              <div>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("depositAddress")}
                </p>
                <code
                  className="text-xs break-all"
                  style={{ color: "var(--text-primary)" }}
                >
                  {deposit?.address}
                </code>
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p>
                  {t("signerFee")}:{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {DEFAULT_MAX_SIGNER_FEE_SATS.toLocaleString()} sats
                  </span>
                </p>
                <p style={{ color: "var(--text-primary)" }}>
                  {t("youReceive")}{" "}
                  {Math.max(0, amount - DEFAULT_MAX_SIGNER_FEE_SATS).toLocaleString()} sats
                </p>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("eta")}
              </p>
            </div>

            {error && (
              <p className="text-[11px]" style={{ color: "#ef4444" }}>{error}</p>
            )}

            <button
              disabled={busy}
              onClick={signAndSend}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {busy ? t("broadcasting") : t("sign")}
            </button>
          </>
        ) : (
          /* ── Step 3: Track ── */
          <>
            <div className="flex flex-col gap-2">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("tracking")}
              </p>
              {txid && (
                <a
                  className="text-[11px] font-semibold flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                  href={`https://mempool.space/tx/${txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txid.slice(0, 10)}… <ArrowUpRight size={11} />
                </a>
              )}
              {deposits.map((d) => (
                <p
                  key={d.txid}
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {d.amountSats.toLocaleString()} sats —{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {d.status === "broadcast"
                      ? t("statusBroadcast")
                      : d.status === "notified"
                      ? t("statusNotified")
                      : t("statusMinted")}
                  </span>
                </p>
              ))}
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {t("close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
