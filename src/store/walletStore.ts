import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletStore {
  isConnected: boolean;
  stxAddress: string | null;
  btcAddress: string | null;
  btcPublicKey: string | null;
  network: "mainnet" | "testnet";
  connect: (stxAddress: string, btcAddress: string, btcPublicKey: string) => void;
  disconnect: () => void;
  setNetwork: (network: "mainnet" | "testnet") => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      isConnected: false,
      stxAddress: null,
      btcAddress: null,
      btcPublicKey: null,
      network: "mainnet",
      connect: (stxAddress, btcAddress, btcPublicKey) =>
        set({ isConnected: true, stxAddress, btcAddress, btcPublicKey }),
      disconnect: () =>
        set({ isConnected: false, stxAddress: null, btcAddress: null, btcPublicKey: null }),
      setNetwork: (network) => set({ network }),
    }),
    { name: "stacks-wallet" }
  )
);
