import { TOKEN_REGISTRY } from '@/lib/token-registry';

export type PriceAlertCondition = 'above' | 'below';

export interface PriceAlert {
  id: string;
  tokenSymbol: string; // e.g. 'STX', 'BTC'
  geckoId: string;     // CoinGecko ID for price lookup
  condition: PriceAlertCondition;
  targetPrice: number;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number; // Set when alert fires — alert is deactivated
}

export interface PriceAlertStoreState {
  alerts: PriceAlert[];
  walletAddress: string;
  setWalletAddress: (addr: string) => void;
  // Replace the entire alerts array — used by the server-hydration hook so
  // the client mirrors authoritative state from Redis.
  setAlerts: (alerts: PriceAlert[]) => void;
  addAlert: (
    tokenSymbol: string,
    geckoId: string,
    condition: PriceAlertCondition,
    targetPrice: number
  ) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  markTriggered: (id: string) => void;
  resetAlert: (id: string) => void;
}

// Tokens available for price alerts — derived from the canonical registry so
// gecko ids stay correct in one place (the legacy hardcoded list had dead ids
// for WELSH and stSTX).
export const PRICE_ALERT_TOKENS: { symbol: string; geckoId: string; name: string }[] =
  TOKEN_REGISTRY.filter((t) => t.alert).map(({ symbol, geckoId, name }) => ({
    symbol,
    geckoId,
    name,
  }));
