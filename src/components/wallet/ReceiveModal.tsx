"use client";

import { useState } from "react";
import { Copy, Check, ArrowDownLeft } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 rounded-2xl bg-popover p-6">
        {/* Header */}
        <DialogHeader className="mb-5 flex-row items-center gap-2 space-y-0 text-left">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={16} className="text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Receive</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--text-muted)' }}>Scan or copy your address</DialogDescription>
          </div>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
