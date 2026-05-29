"use client";

import { useEffect, useState } from "react";
import { Wallet, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { connect as stacksConnect } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";

const VALUE_PROPS = [
  "View your Stacks portfolio in real-time",
  "Automate STX → sBTC DCA — non-custodial",
  "Track stacking rewards across PoX cycles",
  "Swap via Bitflow with one click",
  "Get alerts when prices move past your targets",
];

export default function WalletBanner() {
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);
  const [propIdx, setPropIdx] = useState(0);

  useEffect(() => {
    if (isConnected) return;
    const id = setInterval(() => {
      setPropIdx((i) => (i + 1) % VALUE_PROPS.length);
    }, 3800);
    return () => clearInterval(id);
  }, [isConnected]);

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
    <div className="bg-gradient-to-r from-[#408A71] to-[#285A48] rounded-2xl p-5 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <Wallet size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold">Connect your wallet</p>
          <div className="relative h-5 mt-0.5 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={propIdx}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-white/70 text-sm absolute inset-0 truncate"
              >
                {VALUE_PROPS[propIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="shrink-0 flex items-center gap-2 bg-white text-[#285A48] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#B0E4CC]/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
