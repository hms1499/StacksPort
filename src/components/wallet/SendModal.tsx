"use client";

import { useState } from "react";
import { X, ArrowUpRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { openSTXTransfer, openContractCall } from "@stacks/connect";
import { uintCV, standardPrincipalCV, noneCV, PostConditionMode } from "@stacks/transactions";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";

export interface SendTokenInfo {
  symbol: string;
  name: string;
  rawBalance: string;
  decimals: number;
  contractId: string; // empty string for STX
  imageUri?: string;
}

interface Props {
  token: SendTokenInfo;
  onClose: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

function humanBalance(rawBalance: string, decimals: number): string {
  return (Number(rawBalance) / Math.pow(10, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export default function SendModal({ token, onClose }: Props) {
  const { stxAddress, network } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxHuman = humanBalance(token.rawBalance, token.decimals);
  const isSTX = token.contractId === "";

  function validate(): string | null {
    const prefix = network === "mainnet" ? "SP" : "ST";
    if (!recipient.startsWith(prefix)) return `Address must start with "${prefix}"`;
    if (recipient.length < 30) return "Invalid address";
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return "Enter a valid amount";
    const raw = num * Math.pow(10, token.decimals);
    if (raw > Number(token.rawBalance)) return "Amount exceeds balance";
    return null;
  }

  async function handleSend() {
    const err = validate();
    if (err) { 
      setErrorMsg(err);
      return;
    }
    setErrorMsg(null);
    setStatus("loading");

    const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, token.decimals)));

    try {
      if (isSTX) {
        await openSTXTransfer({
          recipient,
          amount: rawAmount,
          memo: "",
          network,
          onFinish: ({ txId: id }) => {
            setTxId(id);
            setStatus("success");
            addNotification(`Transfer sent: ${amount} ${token.symbol}`, 'success', 'send', 5000, { amount, tokenSymbol: token.symbol });
          },
          onCancel: () => setStatus("idle"),
        });
      } else {
        const [contractAddress, rest] = token.contractId.split(".");
        const contractName = rest.split("::")[0];
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(rawAmount),
            standardPrincipalCV(stxAddress!),
            standardPrincipalCV(recipient),
            noneCV(),
          ],
          postConditionMode: PostConditionMode.Allow,
          network,
          onFinish: ({ txId: id }) => {
            setTxId(id);
            setStatus("success");
            addNotification(`Transfer sent: ${amount} ${token.symbol}`, 'success', 'send', 5000, { amount, tokenSymbol: token.symbol });
          },
          onCancel: () => setStatus("idle"),
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "Transaction failed";
      setErrorMsg(error);
      setStatus("error");
      addNotification(`Transfer failed: ${error}`, 'error', 'send', 5000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
              <ArrowUpRight size={16} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Send {token.symbol}</h2>
              <p className="text-xs text-gray-400">Balance: {maxHuman} {token.symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={17} className="text-gray-500" />
          </button>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <CheckCircle2 size={44} className="text-green-500" />
            <p className="font-semibold text-gray-900">Transaction Submitted!</p>
            <p className="text-xs text-gray-400 break-all">TX: {txId}</p>
            <a
              href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-500 hover:text-teal-600 underline"
            >
              View on Explorer
            </a>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipient */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Recipient Address</label>
              <input
                type="text"
                placeholder={network === "mainnet" ? "SP..." : "ST..."}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-gray-300"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-gray-300 pr-24"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={() => setAmount(String(Number(token.rawBalance) / Math.pow(10, token.decimals)))}
                    className="text-xs text-teal-500 hover:text-teal-600 font-medium"
                  >
                    MAX
                  </button>
                  <span className="text-xs font-medium text-gray-500">{token.symbol}</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {(errorMsg || status === "error") && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} />
                {errorMsg ?? "Something went wrong"}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSend}
              disabled={status === "loading"}
              className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Waiting for wallet...
                </>
              ) : (
                <>
                  <ArrowUpRight size={15} />
                  Send {token.symbol}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
