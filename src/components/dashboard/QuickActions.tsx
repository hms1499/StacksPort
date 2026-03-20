"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownLeft, Users } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { getFungibleTokens } from "@/lib/stacks";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";
import MultisendModal from "@/components/wallet/MultisendModal";

const STX_IMAGE =
  "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png";

export default function QuickActions() {
  const { stxAddress, isConnected } = useWalletStore();
  const [stxBalance, setStxBalance] = useState("0");
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [multisendOpen, setMultisendOpen] = useState(false);

  useEffect(() => {
    if (!isConnected || !stxAddress) return;
    getFungibleTokens(stxAddress)
      .then((data) => setStxBalance(data.stx?.balance ?? "0"))
      .catch(console.error);
  }, [stxAddress, isConnected]);

  if (!isConnected) return null;

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
      <div className="flex gap-3">
        <button
          onClick={() => setSendOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-xl px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowUpRight size={16} className="text-red-500" />
          Send
        </button>
        <button
          onClick={() => setMultisendOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-xl px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Users size={16} className="text-orange-500" />
          Multi-Send
        </button>
        <button
          onClick={() => setReceiveOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-xl px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowDownLeft size={16} className="text-green-500" />
          Receive
        </button>
      </div>

      {sendOpen && (
        <SendModal token={sendToken} onClose={() => setSendOpen(false)} />
      )}
      {multisendOpen && (
        <MultisendModal
          rawStxBalance={stxBalance}
          onClose={() => setMultisendOpen(false)}
        />
      )}
      {receiveOpen && <ReceiveModal onClose={() => setReceiveOpen(false)} />}
    </>
  );
}
