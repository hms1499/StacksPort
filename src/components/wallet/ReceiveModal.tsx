"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, ArrowDownLeft } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";

interface Props {
  onClose: () => void;
}

export default function ReceiveModal({ onClose }: Props) {
  const { stxAddress, network } = useWalletStore();
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!stxAddress) return;
    navigator.clipboard.writeText(stxAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrUrl = stxAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${stxAddress}&size=180x180&margin=10`
    : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <ArrowDownLeft size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Receive</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Scan or copy your address</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
          >
            <X size={17} />
          </button>
        </div>

        {/* Network badge */}
        <div className="flex justify-center mb-4">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={network === "mainnet"
              ? { backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }
              : { backgroundColor: '#fefce8', color: '#ca8a04' }
            }
          >
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: '#fff', border: '1px solid var(--border-subtle)' }}>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Wallet QR Code" width={180} height={180} className="rounded-xl" />
            ) : (
              <div className="w-[180px] h-[180px] rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
            )}
          </div>
        </div>

        {/* Address + copy */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <p className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{stxAddress}</p>
          <button
            onClick={copyAddress}
            className="shrink-0 p-1.5 rounded-lg transition-colors"
            style={copied
              ? { backgroundColor: '#dcfce7', color: '#16a34a' }
              : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
            }
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
          Only send Stacks (STX) and SIP-010 tokens to this address
        </p>
      </div>
    </div>,
    document.body
  );
}
