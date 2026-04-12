"use client";

import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { connectWallet } from "@/lib/wallet";

export default function ConnectWalletCTA() {
  const { connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectWallet(connect);
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: 'var(--accent)',
        boxShadow: connecting ? 'none' : '0 0 16px var(--accent-glow)',
      }}
    >
      {connecting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
