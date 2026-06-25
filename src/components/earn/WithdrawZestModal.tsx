"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bitcoin } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { withdrawZestSbtc, readUserCollateralReserves } from "@/lib/zest";
import {
  sbtcToSats,
  validateWithdrawAmount,
} from "@/lib/domain/zest/amount";
import TxSheet from "@/components/tx/TxSheet";
import AmountField from "@/components/tx/AmountField";
import ReviewRows from "@/components/tx/ReviewRows";
import { useTxFlow } from "@/components/tx/useTxFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently supplied sBTC in sBTC units (not sats). */
  suppliedSbtc: number;
}

export default function WithdrawZestModal({ open, onClose, suppliedSbtc }: Props) {
  const t = useTranslations("earn");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amount, setAmount] = useState("");

  const suppliedSats = sbtcToSats(suppliedSbtc);
  const amt = Number(amount);
  const amountSats = Number.isFinite(amt) && amt > 0 ? sbtcToSats(amt) : 0;
  const validation = validateWithdrawAmount(amountSats, suppliedSats);

  const tx = useTxFlow({
    driver: (onFinish, onCancel) => {
      if (!isConnected || !stxAddress) { onCancel(); return; }
      readUserCollateralReserves(stxAddress).then((reserves) => {
        withdrawZestSbtc(amountSats, stxAddress, reserves, onFinish, onCancel);
      });
    },
    label: t("zest.withdrawCta"),
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
    : validation.reason === "exceeds-supplied" ? t("zest.errExceeds")
    : t("zest.errZero");

  return (
    <TxSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      header={{ icon: Bitcoin, iconBg: "rgba(247, 147, 26, 0.14)", iconColor: "#F7931A", title: t("zest.withdrawTitle") }}
      phase={tx.phase}
      txId={tx.txId}
      canSubmit={validation.ok}
      onSubmit={tx.submit}
      submitLabel={t("zest.withdrawCta")}
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
            [t("zest.withdrawCta"), `${amount} sBTC`],
          ]}
        />
      ) : null}
    >
      <AmountField
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(String(suppliedSbtc))}
        maxLabel={t("zest.max")}
        label={t("zest.amountLabel")}
        balanceLabel={`${t("zest.supplied")}: ${suppliedSbtc.toFixed(8)} sBTC`}
        error={errorText}
        placeholder="0.00000000"
      />
    </TxSheet>
  );
}
