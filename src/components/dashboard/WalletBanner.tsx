"use client";

import { useState } from "react";
import { Wallet, ArrowRight, Loader2 } from "lucide-react";
import { connect as stacksConnect } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";

export default function WalletBanner() {
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  if (isConnected) return null;

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await stacksConnect();
      const stxEntry = result.addresses.find(
        (a) => a.symbol === "STX" || a.address.startsWith("SP") || a.address.startsWith("ST")
      );
      const btcEntry = result.addresses.find(
        (a) => a.symbol === "BTC" || (!a.address.startsWith("SP") && !a.address.startsWith("ST"))
      );
      connect(stxEntry?.address ?? result.addresses[0]?.address ?? "", btcEntry?.address ?? "");
    } catch {
      // user cancelled or error — do nothing
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl p-5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <Wallet size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold">Connect your wallet</p>
          <p className="text-teal-100 text-sm mt-0.5">
            View your Stacks portfolio in real-time
          </p>
        </div>
      </div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 bg-white text-teal-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {connecting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            Connect
            <ArrowRight size={15} />
          </>
        )}
      </button>
    </div>
  );
}
