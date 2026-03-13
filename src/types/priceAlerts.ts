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

// Tokens available for price alerts
export const PRICE_ALERT_TOKENS: { symbol: string; geckoId: string; name: string }[] = [
  { symbol: 'STX',    geckoId: 'blockstack',       name: 'Stacks' },
  { symbol: 'BTC',    geckoId: 'bitcoin',           name: 'Bitcoin' },
  { symbol: 'WELSH',  geckoId: 'welshcorgicoin',    name: 'Welsh Corgi' },
  { symbol: 'ALEX',   geckoId: 'alexgo',            name: 'ALEX' },
  { symbol: 'VELAR',  geckoId: 'velar',             name: 'Velar' },
  { symbol: 'stSTX',  geckoId: 'staked-stx',        name: 'Staked STX' },
];
