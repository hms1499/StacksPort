"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { stakeStx, fetchStxPerStStx } from "@/lib/stacking-dao";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";
import TxSheet from "@/components/tx/TxSheet";
import AmountField from "@/components/tx/AmountField";
import ReviewRows from "@/components/tx/ReviewRows";
import { useTxFlow } from "@/components/tx/useTxFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  availableStx: number;
  stStxStakedStx?: number;
}

export default function StakeStxModal({ open, onClose, availableStx, stStxStakedStx = 0 }: Props) {
  const t = useTranslations("assets.stake");
  const tx18 = useTranslations("earn.tx");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchStxPerStStx().then((r) => { if (active) setRate(r); });
    return () => { active = false; };
  }, [open]);

  const availableUstx = idleStx(stxToMicro(availableStx));
  const amt = Number(amount);
  const amountUstx = Number.isFinite(amt) && amt > 0 ? stxToMicro(amt) : 0;
  const validation = validateStakeAmount(amountUstx, availableUstx);
  const estStStx = rate ? microToSTX(estimateStStxReceived(amountUstx, rate)) : null;

  const tx = useTxFlow({
    driver: (onFinish, onCancel) => {
      if (!isConnected || !stxAddress) { addNotification(t("connectFirst"), "error", "wallet", 5000); onCancel(); return; }
      stakeStx(amountUstx, stxAddress, onFinish, onCancel);
    },
    label: t("txLabel"),
    category: "wallet",
    context: { tokenSymbol: "stSTX", amount, action: "created" },
    address: stxAddress,
    submittedMessage: t("submittedTitle"),
    addNotification,
  });

  useEffect(() => { if (open) { setAmount(""); tx.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorText =
    amountUstx === 0 ? null
    : validation.ok ? null
    : validation.reason === "below-min" ? t("minError", { min: MIN_STAKE_USTX / 1_000_000 })
    : t("balanceError");

  return (
    <TxSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      header={{ icon: Lock, iconBg: "var(--accent-dim)", iconColor: "var(--accent)", title: t("title"), subtitle: t("subtitle") }}
      phase={tx.phase}
      txId={tx.txId}
      canSubmit={validation.ok}
      onSubmit={tx.submit}
      submitLabel={t("submit")}
      submittingLabel={tx18("confirmInWallet")}
      statusCopy={{
        submitted: tx18("submitted"), confirmed: tx18("confirmed"),
        failed: tx18("failed"), viewOnExplorer: tx18("viewOnExplorer"),
      }}
      nextActions={[{ label: tx18("nextEarn"), href: "/earn" }]}
      review={validation.ok && amountUstx > 0 ? (
        <ReviewRows
          title={tx18("reviewTitle")}
          rows={[
            [t("submit"), `${amount} STX`],
            ...(estStStx !== null ? [[t("estReceive", { amount: estStStx.toFixed(2) }), ""] as [string, string]] : []),
          ]}
        />
      ) : null}
    >
      <AmountField
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(String(microToSTX(availableUstx)))}
        maxLabel={t("max")}
        label={t("amountLabel")}
        balanceLabel={t("balance", { balance: microToSTX(availableUstx).toFixed(2) })}
        error={errorText}
        placeholder="0.00"
      />
    </TxSheet>
  );
}
