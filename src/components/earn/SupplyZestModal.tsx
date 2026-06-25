"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bitcoin } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { supplyZestSbtc } from "@/lib/zest";
import {
  sbtcToSats, satsToSbtc, validateSupplyAmount, estimateZTokenReceived,
} from "@/lib/domain/zest/amount";
import TxSheet from "@/components/tx/TxSheet";
import AmountField from "@/components/tx/AmountField";
import ReviewRows from "@/components/tx/ReviewRows";
import { useTxFlow } from "@/components/tx/useTxFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  availableSbtc: number;
}

export default function SupplyZestModal({ open, onClose, availableSbtc }: Props) {
  const t = useTranslations("earn");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amount, setAmount] = useState("");

  const availableSats = sbtcToSats(availableSbtc);
  const amt = Number(amount);
  const amountSats = Number.isFinite(amt) && amt > 0 ? sbtcToSats(amt) : 0;
  const validation = validateSupplyAmount(amountSats, availableSats);
  const estZ = satsToSbtc(estimateZTokenReceived(amountSats));

  const tx = useTxFlow({
    driver: (onFinish, onCancel) => {
      if (!isConnected || !stxAddress) { onCancel(); return; }
      supplyZestSbtc(amountSats, stxAddress, onFinish, onCancel);
    },
    label: t("zest.supplyCta"),
    category: "wallet",
    context: { tokenSymbol: "sBTC", amount, action: "created" },
    address: stxAddress,
    submittedMessage: t("zest.submitted"),
    addNotification,
  });

  // Reset form + flow each time the modal opens.
  useEffect(() => { if (open) { setAmount(""); tx.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorText =
    amountSats === 0 ? null
    : validation.ok ? null
    : validation.reason === "below-min" ? t("zest.errBelowMin")
    : validation.reason === "insufficient" ? t("zest.errInsufficient")
    : t("zest.errZero");

  return (
    <TxSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      header={{ icon: Bitcoin, iconBg: "rgba(247, 147, 26, 0.14)", iconColor: "#F7931A", title: t("zest.supplyTitle") }}
      phase={tx.phase}
      txId={tx.txId}
      canSubmit={validation.ok}
      onSubmit={tx.submit}
      submitLabel={t("zest.supplyCta")}
      submittingLabel={t("tx.confirmInWallet")}
      statusCopy={{
        submitted: t("tx.submitted"), confirmed: t("tx.confirmed"),
        failed: t("tx.failed"), viewOnExplorer: t("tx.viewOnExplorer"),
      }}
      nextActions={[{ label: t("tx.nextEarn"), href: "/earn" }]}
      review={validation.ok && amountSats > 0 ? (
        <ReviewRows
          title={t("tx.reviewTitle")}
          rows={[
            [t("zest.supplyCta"), `${amount} sBTC`],
            [t("zest.receiveEst", { amount: estZ.toFixed(8) }), ""],
          ]}
        />
      ) : null}
    >
      <AmountField
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(String(availableSbtc))}
        maxLabel={t("zest.max")}
        label={t("zest.amountLabel")}
        balanceLabel={`${t("zest.available")}: ${availableSbtc.toFixed(8)} sBTC`}
        error={errorText}
        placeholder="0.00000000"
      />
    </TxSheet>
  );
}
