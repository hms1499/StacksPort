"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { openSTXTransfer, openContractCall } from "@stacks/connect";
import { uintCV, standardPrincipalCV, noneCV, PostConditionMode } from "@stacks/transactions";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { Loader2, AlertCircle, CheckCircle2, ArrowUpRight } from "lucide-react";
import type { TokenWithValue } from "@/lib/stacks";

type SendStatus = "idle" | "loading" | "success" | "error";

function formatBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  return n.toFixed(8);
}

export default function QuickSend({
  token,
  isSTX,
}: {
  token: TokenWithValue;
  isSTX: boolean;
}) {
  const t = useTranslations("assets.drawer.qsend");
  const { stxAddress, network, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isConnected || !stxAddress) return null;

  const addrPrefix = network === "mainnet" ? "SP" : "ST";
  const numAmount = Number(amount);
  const exceedsBalance = numAmount > token.balance;

  const validate = (): string | null => {
    if (!recipient.startsWith(addrPrefix)) return t("addrMustStart", { prefix: addrPrefix });
    if (recipient.length < 30) return t("invalidAddr");
    if (!Number.isFinite(numAmount) || numAmount <= 0) return t("enterAmount");
    if (exceedsBalance) return t("amountExceeds");
    return null;
  };

  const onSend = async () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }
    setErrorMsg(null);
    setStatus("loading");

    const rawAmount = BigInt(Math.floor(numAmount * Math.pow(10, token.decimals)));

    const onFinish = ({ txId: id }: { txId: string }) => {
      setTxId(id);
      setStatus("success");
      addNotification(
        t("transferSubmittedToast", { amount, symbol: token.symbol }),
        "info",
        "send",
        5000,
        { txId: id, amount, tokenSymbol: token.symbol }
      );
      trackTx({
        txId: id,
        label: t("transferLabel", { amount, symbol: token.symbol }),
        category: "send",
        context: { txId: id, amount, tokenSymbol: token.symbol },
        addNotification,
        address: stxAddress,
      });
    };

    try {
      if (isSTX) {
        await openSTXTransfer({
          recipient,
          amount: rawAmount,
          memo: "",
          network,
          onFinish,
          onCancel: () => setStatus("idle"),
        });
      } else {
        const [contractAddress, rest] = (token.contractId || "").split(".");
        const contractName = rest?.split("::")[0] ?? "";
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(rawAmount),
            standardPrincipalCV(stxAddress),
            standardPrincipalCV(recipient),
            noneCV(),
          ],
          postConditionMode: PostConditionMode.Allow,
          network,
          onFinish,
          onCancel: () => setStatus("idle"),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("txFailed");
      setErrorMsg(msg);
      setStatus("error");
      addNotification(t("transferFailedToast", { msg }), "error", "send", 5000);
    }
  };

  const onMax = () => setAmount(String(token.balance));

  if (status === "success" && txId) {
    return (
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("submitted")}
            </p>
            <a
              href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline truncate block"
              style={{ color: "var(--accent)" }}
            >
              {t("viewExplorer")}
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setTxId(null);
              setRecipient("");
              setAmount("");
            }}
            className="text-xs font-semibold px-2 py-1 rounded-md"
            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            {t("newBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <p
        className="text-xs uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {t("title")}
      </p>

      <input
        type="text"
        value={recipient}
        onChange={(e) => {
          setRecipient(e.target.value.trim());
          if (errorMsg) setErrorMsg(null);
          if (status === "error") setStatus("idle");
        }}
        placeholder={`${addrPrefix}…`}
        className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-primary)",
        }}
        aria-label="Recipient address"
      />

      <div
        className="rounded-xl p-3 mt-2 flex items-center gap-2"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            setAmount(v);
            if (errorMsg) setErrorMsg(null);
            if (status === "error") setStatus("idle");
          }}
          placeholder="0.0"
          className="flex-1 bg-transparent outline-none text-base font-mono"
          style={{ color: "var(--text-primary)" }}
          aria-label={`Amount in ${token.symbol}`}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {token.symbol}
        </span>
        <button
          type="button"
          onClick={onMax}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
          style={{
            backgroundColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          {t("max")}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 min-h-[18px] text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          {t("balance", { bal: formatBalance(token.balance), symbol: token.symbol })}
        </span>
        {exceedsBalance && (
          <span className="text-red-500 font-medium">{t("exceeds")}</span>
        )}
      </div>

      {errorMsg && (
        <div
          className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}
        >
          <AlertCircle size={12} />
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={onSend}
        disabled={status === "loading"}
        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        style={{ backgroundColor: "var(--accent)", color: "#0A1628" }}
      >
        {status === "loading" ? (
          <>
            <Loader2 size={14} className="animate-spin" /> {t("waiting")}
          </>
        ) : (
          <>
            <ArrowUpRight size={14} /> {t("sendSymbol", { symbol: token.symbol })}
          </>
        )}
      </button>
    </div>
  );
}
