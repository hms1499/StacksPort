"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Repeat2,
  Bell,
  Users,
} from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useFungibleTokens } from "@/hooks/useMarketData";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";
import MultisendModal from "@/components/wallet/MultisendModal";

const STX_IMAGE =
  "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png";

const ACTION_CLASS =
  "group flex min-w-[104px] flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";

const ICON_CLASS = "flex h-7 w-7 items-center justify-center rounded-lg shrink-0";

const actionStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};

const primaryActionStyle = {
  backgroundColor: "var(--accent)",
  border: "1px solid var(--accent)",
  color: "#060C18",
};

function hoverStyle(e: React.MouseEvent<HTMLElement>, active: boolean) {
  if (active) return;
  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)";
}

function idleStyle(e: React.MouseEvent<HTMLElement>, active: boolean) {
  if (active) return;
  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-card)";
}

export default function QuickActions() {
  const { stxAddress, isConnected } = useWalletStore();
  const { data: balanceData } = useFungibleTokens(
    isConnected && stxAddress ? stxAddress : undefined
  );
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [multisendOpen, setMultisendOpen] = useState(false);

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
      <div className="flex h-full flex-wrap items-center gap-2 overflow-hidden">
        <Link href="/trade" className="flex flex-1 min-w-[104px]">
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`${ACTION_CLASS} cursor-pointer shadow-sm`}
            style={primaryActionStyle}
          >
            <span className={ICON_CLASS} style={{ backgroundColor: "rgba(6,12,24,0.12)" }}>
              <ArrowLeftRight size={15} />
            </span>
            <span>Swap</span>
          </motion.div>
        </Link>

        <Link href="/dca" className="flex flex-1 min-w-[104px]">
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`${ACTION_CLASS} cursor-pointer shadow-sm`}
            style={actionStyle}
            onMouseEnter={(e) => hoverStyle(e, false)}
            onMouseLeave={(e) => idleStyle(e, false)}
          >
            <span className={ICON_CLASS} style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
              <Repeat2 size={15} />
            </span>
            <span>DCA</span>
          </motion.div>
        </Link>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setReceiveOpen(true)}
          className={ACTION_CLASS}
          style={actionStyle}
          onMouseEnter={(e) => hoverStyle(e, false)}
          onMouseLeave={(e) => idleStyle(e, false)}
        >
          <span className={ICON_CLASS} style={{ backgroundColor: "rgba(0,194,122,0.12)", color: "var(--positive)" }}>
            <ArrowDownLeft size={15} />
          </span>
          <span>Receive</span>
        </motion.button>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSendOpen(true)}
          className={ACTION_CLASS}
          style={actionStyle}
          onMouseEnter={(e) => hoverStyle(e, false)}
          onMouseLeave={(e) => idleStyle(e, false)}
        >
          <span className={ICON_CLASS} style={{ backgroundColor: "rgba(240,74,110,0.10)", color: "var(--negative)" }}>
            <ArrowUpRight size={15} />
          </span>
          <span>Send</span>
        </motion.button>

        <Link href="/notifications?tab=price-alerts" className="flex flex-1 min-w-[104px]">
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`${ACTION_CLASS} cursor-pointer`}
            style={actionStyle}
            onMouseEnter={(e) => hoverStyle(e, false)}
            onMouseLeave={(e) => idleStyle(e, false)}
          >
            <span className={ICON_CLASS} style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
              <Bell size={15} />
            </span>
            <span>Alert</span>
          </motion.div>
        </Link>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMultisendOpen(true)}
          className={`${ACTION_CLASS} max-w-[132px]`}
          style={actionStyle}
          onMouseEnter={(e) => hoverStyle(e, false)}
          onMouseLeave={(e) => idleStyle(e, false)}
        >
          <span className={ICON_CLASS} style={{ backgroundColor: "rgba(251,146,60,0.12)", color: "#FB923C" }}>
            <Users size={15} />
          </span>
          <span>Batch</span>
        </motion.button>
      </div>

      {sendOpen && <SendModal token={sendToken} onClose={() => setSendOpen(false)} />}
      {multisendOpen && <MultisendModal rawStxBalance={stxBalance} onClose={() => setMultisendOpen(false)} />}
      {receiveOpen && <ReceiveModal onClose={() => setReceiveOpen(false)} />}
    </>
  );
}
