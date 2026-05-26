"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, Users, ArrowLeftRight, Repeat2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useFungibleTokens } from "@/hooks/useMarketData";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";
import MultisendModal from "@/components/wallet/MultisendModal";

const STX_IMAGE =
  "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png";

const BTN = "flex items-center gap-2 glass-card shadow-sm rounded-xl px-5 py-2.5 text-sm font-medium transition-all";

function useHover() {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)"),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) =>
      ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-card)"),
  };
}

export default function QuickActions() {
  const { stxAddress, isConnected } = useWalletStore();
  const { data: balanceData } = useFungibleTokens(
    isConnected && stxAddress ? stxAddress : undefined
  );
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [multisendOpen, setMultisendOpen] = useState(false);
  const hover = useHover();

  if (!isConnected) return null;

  const stxBalance = balanceData?.stx?.balance ?? "0";

  const sendToken: SendTokenInfo = {
    symbol: "STX",
    name: "Stacks",
    rawBalance: stxBalance,
    decimals: 6,
    contractId: "",
    imageUri: STX_IMAGE,
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center content-center">
        <Link href="/trade">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className={`${BTN} cursor-pointer`}
            style={{ color: "var(--text-primary)" }} {...hover}
          >
            <ArrowLeftRight size={16} className="text-blue-500" />
            Swap
          </motion.div>
        </Link>

        <Link href="/dca">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className={`${BTN} cursor-pointer`}
            style={{ color: "var(--text-primary)" }} {...hover}
          >
            <Repeat2 size={16} className="text-purple-500" />
            DCA
          </motion.div>
        </Link>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setSendOpen(true)}
          className={BTN}
          style={{ color: "var(--text-primary)" }} {...hover}
        >
          <ArrowUpRight size={16} className="text-red-500" />
          Send
        </motion.button>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setMultisendOpen(true)}
          className={BTN}
          style={{ color: "var(--text-primary)" }} {...hover}
        >
          <Users size={16} className="text-orange-500" />
          Multi-Send
        </motion.button>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setReceiveOpen(true)}
          className={BTN}
          style={{ color: "var(--text-primary)" }} {...hover}
        >
          <ArrowDownLeft size={16} className="text-green-500" />
          Receive
        </motion.button>
      </div>

      {sendOpen && <SendModal token={sendToken} onClose={() => setSendOpen(false)} />}
      {multisendOpen && <MultisendModal rawStxBalance={stxBalance} onClose={() => setMultisendOpen(false)} />}
      {receiveOpen && <ReceiveModal onClose={() => setReceiveOpen(false)} />}
    </>
  );
}
