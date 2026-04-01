"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, ArrowDownLeft } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";

interface Props {
  onClose: () => void;
}

export default function ReceiveModal({ onClose }: Props) {
  const { stxAddress, network } = useWalletStore();
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!stxAddress) return;
    navigator.clipboard.writeText(stxAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrUrl = stxAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${stxAddress}&size=180x180&margin=10`
    : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <ArrowDownLeft size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Receive</h2>
              <p className="text-xs text-gray-400">Scan or copy your address</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={17} className="text-gray-500" />
          </button>
        </div>

        {/* Network badge */}
        <div className="flex justify-center mb-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            network === "mainnet"
              ? "bg-[#B0E4CC]/20 text-[#285A48]"
              : "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20"
          }`}>
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <div className="p-3 bg-white border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="Wallet QR Code"
                width={180}
                height={180}
                className="rounded-xl"
              />
            ) : (
              <div className="w-[180px] h-[180px] bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            )}
          </div>
        </div>

        {/* Address + copy */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <p className="text-xs text-gray-600 dark:text-gray-300 font-mono flex-1 truncate">{stxAddress}</p>
          <button
            onClick={copyAddress}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              copied
                ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 border border-gray-200 dark:border-gray-600"
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Only send Stacks (STX) and SIP-010 tokens to this address
        </p>
      </div>
    </div>,
    document.body
  );
}
