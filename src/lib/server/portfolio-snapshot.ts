import {
  getPortfolioValue,
  getFungibleTokens,
  getTransactions,
  getTokensWithValues,
  getPnLData,
  getStackingStatus,
  getSBTCData,
  type PortfolioValue,
  type TokenWithValue,
  type PnLData,
  type StackingStatus,
  type SBTCData,
} from "@/lib/stacks";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import { recordSnapshot } from "./portfolio-history";

// Top-N transactions cached in the snapshot. Callers slice client-side to the
// limit they need (8 for RecentActivity, 20 for WelcomeSteps).
const TX_LIMIT = 20;

// Snapshot fetch budget per source. Hiro can spike to 5–10s under load; we
// would rather degrade a single field than block the whole response.
const SOURCE_TIMEOUT_MS = 8_000;

export type FungibleTokens = Awaited<ReturnType<typeof getFungibleTokens>>;
export type TransactionsPage = Awaited<ReturnType<typeof getTransactions>>;
export type TokensWithValues = {
  stx: TokenWithValue;
  tokens: TokenWithValue[];
  totalUsd: number;
};

export interface PortfolioSnapshot {
  generatedAt: number;
  address: string;
  portfolio: PortfolioValue | null;
  fungibleTokens: FungibleTokens | null;
  tokensWithValues: TokensWithValues | null;
  transactions: TransactionsPage | null;
  dcaPlans: DCAPlan[] | null;
  pnl: PnLData | null;
  stackingStatus: StackingStatus | null;
  sbtcData: SBTCData | null;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("source timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await timeout(p, SOURCE_TIMEOUT_MS);
  } catch {
    return null;
  }
}

export async function getPortfolioSnapshot(address: string): Promise<PortfolioSnapshot> {
  const [
    portfolio,
    fungibleTokens,
    tokensWithValues,
    transactions,
    dcaPlans,
    pnl,
    stackingStatus,
    sbtcData,
  ] = await Promise.all([
    safe(getPortfolioValue(address)),
    safe(getFungibleTokens(address)),
    safe(getTokensWithValues(address)),
    safe(getTransactions(address, TX_LIMIT)),
    safe(getUserPlans(address)),
    safe(getPnLData(address)),
    safe(getStackingStatus(address)),
    safe(getSBTCData(address)),
  ]);

  if (tokensWithValues && tokensWithValues.totalUsd > 0) {
    // Fire-and-forget: never block the response on history writes.
    void recordSnapshot(
      address,
      tokensWithValues.stx,
      tokensWithValues.tokens,
      tokensWithValues.totalUsd
    ).catch(() => {});
  }

  return {
    generatedAt: Date.now(),
    address,
    portfolio,
    fungibleTokens,
    tokensWithValues,
    transactions,
    dcaPlans,
    pnl,
    stackingStatus,
    sbtcData,
  };
}

// STX addresses: SP/ST (mainnet/testnet) + Crockford base32 body. The strict
// alphabet excludes O/I/L; we accept the slightly looser [0-9A-Z] form which
// is enough to keep junk out of the cache key namespace.
const ADDRESS_RE = /^S[PT][0-9A-Z]{38,40}$/;

export function isValidStacksAddress(address: string): boolean {
  return ADDRESS_RE.test(address);
}
