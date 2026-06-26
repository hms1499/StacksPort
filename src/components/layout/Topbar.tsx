"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun, Loader2, Copy, Check, RefreshCw, LogOut, Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import { shortenAddress, cn } from "@/lib/utils";
import { connectWallet } from "@/lib/wallet";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import CommandPalette from "@/components/layout/CommandPalette";
import STXChip from "@/components/layout/STXChip";
import { motion, AnimatePresence } from "framer-motion";
import { dropdown, dropdownTransition } from "@/lib/animations";

interface TopbarProps {
  title?: string;
}

export default function Topbar({ title = "Dashboard" }: TopbarProps) {
  const t = useTranslations("common");
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
      // user cancelled
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
    <header
      className="h-14 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Title ── */}
      <div className="flex-1 flex items-center gap-3">
        <h1
          className="font-bold text-base tracking-tight"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>

        {/* Live STX price chip → click for popover with sparkline + 24h range */}
        <STXChip />
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-1">
        <CommandPalette />
        <NotificationBadge />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
          className={cn(
            "p-2 rounded-xl hidden md:flex relative overflow-hidden",
            "transition-[background-color,color] duration-200",
            "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-secondary)]",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </button>

        {/* Wallet */}
        {isConnected && stxAddress ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label={t("openAccountMenu")}
              data-connected="true"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: 'var(--accent-dim)',
                border: '1px solid var(--border-active)',
                color: 'var(--accent-text)',
              }}
            >
              {/* Avatar dot */}
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'var(--accent)', color: '#060C18' }}
              >
                {stxAddress.slice(2, 3).toUpperCase()}
              </span>
              <span
                className="text-sm font-semibold font-data hidden sm:block"
                style={{ letterSpacing: '0.01em' }}
              >
                {shortenAddress(stxAddress)}
              </span>
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <motion.div
                    variants={dropdown}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={dropdownTransition}
                    className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t("connected")}
                    </p>
                    <p
                      className="text-xs font-semibold truncate font-data"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {stxAddress}
                    </p>
                  </div>

                  <button
                    onClick={handleCopyAddress}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                      "transition-[background-color] duration-150",
                      "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]",
                    )}
                  >
                    {copied
                      ? <Check size={14} style={{ color: 'var(--accent-text)' }} />
                      : <Copy size={14} />
                    }
                    {copied ? t("copied") : t("copyAddress")}
                  </button>

                  <button
                    onClick={() => { setDropdownOpen(false); void handleConnect(); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                      "transition-[background-color] duration-150",
                      "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]",
                    )}
                  >
                    <RefreshCw size={14} />
                    {t("switchAccount")}
                  </button>

                  <Link
                    href={`https://explorer.hiro.so/address/${stxAddress}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDropdownOpen(false)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                      "transition-[background-color] duration-150",
                      "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]",
                    )}
                  >
                    <Compass size={14} />
                    {t("explore")}
                  </Link>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                    <button
                      onClick={handleDisconnect}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5",
                        "transition-[background-color] duration-150",
                        "text-[var(--negative)] hover:bg-[rgba(240,74,110,0.08)]",
                      )}
                    >
                      <LogOut size={14} />
                      {t("disconnect")}
                    </button>
                  </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#060C18',
              boxShadow: connecting ? 'none' : '0 0 12px var(--accent-glow)',
            }}
          >
            {connecting && <Loader2 size={13} className="animate-spin" />}
            {connecting ? t("connecting") : t("connectWallet")}
          </button>
        )}
      </div>
    </header>
  );
}
