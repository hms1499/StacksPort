"use client";

import { useState } from "react";
import { Search, Bell, Moon, ChevronLeft, Loader2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { shortenAddress, cn } from "@/lib/utils";
import { connect as stacksConnect } from "@stacks/connect";

interface TopbarProps {
  title?: string;
}

export default function Topbar({ title = "Dashboard" }: TopbarProps) {
  const { isConnected, stxAddress, connect, disconnect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      connect(
        stxEntry?.address ?? result.addresses[0]?.address ?? "",
        btcEntry?.address ?? ""
      );
    } catch {
      // user cancelled or error — do nothing
    } finally {
      setConnecting(false);
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Title */}
      <div className="flex items-center gap-2 flex-1">
        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <h1 className="font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <Search size={18} className="text-gray-500" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors relative">
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <Moon size={18} className="text-gray-500" />
        </button>

        {isConnected && stxAddress ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                <span className="text-white text-xs font-medium">{stxAddress.slice(0, 1)}</span>
              </div>
              <span className="text-sm font-medium text-gray-700">{shortenAddress(stxAddress)}</span>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Connected</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{stxAddress}</p>
                  </div>
                  <button
                    onClick={() => { disconnect(); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors",
              "bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {connecting && <Loader2 size={13} className="animate-spin" />}
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
