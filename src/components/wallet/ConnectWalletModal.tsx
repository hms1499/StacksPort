"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/store/walletStore";
import { connectWallet } from "@/lib/wallet";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const { connect } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (walletType: "leather" | "xverse") => {
    void walletType;
    setLoading(true);
    setError(null);
    try {
      await connectWallet(connect);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg.includes("cancelled") || msg.includes("cancel") ? null : msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          Connect your Stacks wallet to view your portfolio
        </p>

        <div className="space-y-3">
          <WalletOption
            name="Leather"
            description="Bitcoin & Stacks wallet"
            color="bg-orange-50 hover:bg-orange-100 border-orange-200"
            disabled={loading}
            onClick={() => handleConnect("leather")}
          />
          <WalletOption
            name="Xverse"
            description="Bitcoin & Stacks wallet"
            color="bg-purple-50 hover:bg-purple-100 border-purple-200"
            disabled={loading}
            onClick={() => handleConnect("xverse")}
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            Waiting for wallet...
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center mt-3">{error}</p>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">
          By connecting, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

interface WalletOptionProps {
  name: string;
  description: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}

function WalletOption({ name, description, color, disabled, onClick }: WalletOptionProps) {
  const initials = name[0];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed",
        color
      )}
    >
      <div className="w-11 h-11 rounded-full bg-white shadow flex items-center justify-center font-bold text-gray-700 text-sm border">
        {initials}
      </div>
      <div>
        <p className="font-medium text-gray-900 text-sm">{name}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}
