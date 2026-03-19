"use client";

import { useState } from "react";
import { Moon, Sun, ChevronLeft, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import { shortenAddress, cn } from "@/lib/utils";
import { connectWallet } from "@/lib/wallet";
import NotificationBadge from "@/components/notifications/NotificationBadge";

interface TopbarProps {
  title?: string;
}

export default function Topbar({ title = "Dashboard" }: TopbarProps) {
  const { isConnected, stxAddress, connect, disconnect } = useWalletStore();
  const { theme, toggleTheme } = useThemeStore();
  const [connecting, setConnecting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectWallet(connect);
    } catch {
      // user cancelled or error — do nothing
    } finally {
      setConnecting(false);
    }
  }

  function handleCopyAddress() {
    if (!stxAddress) return;
    navigator.clipboard.writeText(stxAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDisconnect() {
    disconnect();
    setDropdownOpen(false);
  }

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
      {/* Title */}
      <div className="flex items-center gap-2 flex-1">
        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors hidden md:flex">
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 text-base">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <NotificationBadge />
        <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors hidden md:flex">
          {theme === "dark" ? <Sun size={18} className="text-gray-400" /> : <Moon size={18} className="text-gray-500" />}
        </button>

        {isConnected && stxAddress ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-xl transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                <span className="text-white text-xs font-medium">{stxAddress.slice(0, 1)}</span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{shortenAddress(stxAddress)}</span>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Connected</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{stxAddress}</p>
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); void handleConnect(); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Switch Account
                  </button>
                  <button
                    onClick={() => handleDisconnect()}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
