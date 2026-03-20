"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";
import { parseWalletAddresses } from "@/lib/wallet";

// Leather wallet provider type
interface LeatherProvider {
  request: (method: string) => Promise<{
    result: { addresses: Array<{ address: string; symbol: string }> };
  }>;
  on: (event: string, callback: () => void) => void;
  removeListener: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    LeatherProvider?: LeatherProvider;
  }
}

/**
 * Syncs wallet state when user switches accounts in Leather/Xverse.
 * - Listens to Leather's `accountChange` event for real-time updates
 * - Re-validates on window focus (works for all wallets)
 */
export function useWalletSync() {
  const { isConnected, stxAddress, connect } = useWalletStore();

  useEffect(() => {
    if (!isConnected) return;

    async function checkCurrentAccount() {
      try {
        const provider = window.LeatherProvider;
        if (!provider) return;

        const response = await provider.request("getAddresses");
        const { stxAddress: newStx, btcAddress: newBtc } = parseWalletAddresses(
          response.result.addresses
        );

        if (newStx && newStx !== stxAddress) {
          connect(newStx, newBtc);
        }
      } catch {
        // Provider unavailable or user has not granted permission — silently ignore
      }
    }

    window.LeatherProvider?.on("accountChange", checkCurrentAccount);
    window.addEventListener("focus", checkCurrentAccount);

    return () => {
      window.LeatherProvider?.removeListener("accountChange", checkCurrentAccount);
      window.removeEventListener("focus", checkCurrentAccount);
    };
  }, [isConnected, stxAddress, connect]);
}
