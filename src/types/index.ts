export interface WalletState {
  isConnected: boolean;
  stxAddress: string | null;
  btcAddress: string | null;
  network: "mainnet" | "testnet";
}

export interface TokenBalance {
  contractId: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  logoUrl?: string;
  priceUsd?: number;
}

export interface STXBalance {
  balance: string;
  locked: string;
  burnchainLockHeight: number;
  burnchainUnlockHeight: number;
  lockTxId: string;
  lockHeight: number;
  totalSent: string;
  totalReceived: string;
  totalFeesSent: string;
}

export interface BalanceChartPoint {
  date: string;
  value: number;
}

export interface Transaction {
  txId: string;
  type: "token_transfer" | "contract_call" | "smart_contract" | "coinbase";
  status: "success" | "pending" | "failed";
  senderAddress: string;
  amount: string;
  fee: string;
  timestamp: number;
  blockHeight?: number;
}
