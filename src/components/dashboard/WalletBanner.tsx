"use client";

import { useState } from "react";
import { Wallet, ArrowRight } from "lucide-react";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { useWalletStore } from "@/store/walletStore";

export default function WalletBanner() {
  const { isConnected } = useWalletStore();
  const [open, setOpen] = useState(false);

  if (isConnected) return null;

  return (
    <>
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
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-white text-teal-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-colors"
        >
          Connect
          <ArrowRight size={15} />
        </button>
      </div>
      <ConnectWalletModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
