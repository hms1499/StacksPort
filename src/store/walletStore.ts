import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletStore {
  isConnected: boolean;
  stxAddress: string | null;
  btcAddress: string | null;
  network: "mainnet" | "testnet";
  connect: (stxAddress: string, btcAddress: string) => void;
  disconnect: () => void;
  setNetwork: (network: "mainnet" | "testnet") => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      isConnected: false,
      stxAddress: null,
      btcAddress: null,
      network: "mainnet",
      connect: (stxAddress, btcAddress) =>
        set({ isConnected: true, stxAddress, btcAddress }),
      disconnect: () =>
        set({ isConnected: false, stxAddress: null, btcAddress: null }),
      setNetwork: (network) => set({ network }),
    }),
    { name: "stacks-wallet" }
  )
);
