"use client";

import { useState } from "react";
import { Moon, Sun, Loader2, Copy, Check, RefreshCw, LogOut } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import { shortenAddress, cn } from "@/lib/utils";
import { connectWallet } from "@/lib/wallet";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import CommandPalette from "@/components/layout/CommandPalette";

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
      <div className="flex-1">
        <h1
          className="font-bold text-base tracking-tight"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-1">
        <CommandPalette />
        <NotificationBadge />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-colors hidden md:flex"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border-subtle)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          {theme === "dark"
            ? <Sun size={16} />
            : <Moon size={16} />
          }
        </button>

        {/* Wallet */}
        {isConnected && stxAddress ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: 'var(--accent-dim)',
                border: '1px solid var(--border-active)',
                color: 'var(--accent)',
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

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div
                  className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Connected
                    </p>
                    <p
                      className="text-xs font-semibold truncate font-data"
                      style={{ color: 'var(--accent)' }}
                    >
                      {stxAddress}
                    </p>
                  </div>

                  <button
                    onClick={handleCopyAddress}
                    className={cn("w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors")}
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    {copied
                      ? <Check size={14} style={{ color: 'var(--accent)' }} />
                      : <Copy size={14} />
                    }
                    {copied ? "Copied!" : "Copy Address"}
                  </button>

                  <button
                    onClick={() => { setDropdownOpen(false); void handleConnect(); }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <RefreshCw size={14} />
                    Switch Account
                  </button>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                    <button
                      onClick={handleDisconnect}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
                      style={{ color: 'var(--negative)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240, 74, 110, 0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </div>
                </div>
              </>
            )}
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
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
