const HIRO_API_BASE = "https://api.hiro.so";
const COINGECKO_API = "/api/coingecko";

export interface TrendingToken {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  image: string;
  sparkline: number[];
}

// Map contract name (between "." and "::") → CoinGecko ID + decimals
// For tokens not on CoinGecko (stablecoins pegged to USD), use geckoId: null and fixedUsdPrice
const CONTRACT_NAME_TO_GECKO: Record<string, { geckoId: string | null; decimals: number; fixedUsdPrice?: number }> = {
  "welshcorgicoin-token": { geckoId: "welshcorgicoin", decimals: 6 },
  "age000-governance-token": { geckoId: "alexgo", decimals: 8 },
  "velar-token": { geckoId: "velar", decimals: 6 },
  "sbtc-token": { geckoId: "bitcoin", decimals: 8 },
  "ststx-token": { geckoId: "staked-stx", decimals: 6 },
  // USDCx — bridged USDC on Stacks (SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)
  // Pegged 1:1 to USDC, use fixed price instead of CoinGecko lookup
  "usdcx": { geckoId: null, decimals: 6, fixedUsdPrice: 1 },
};

export interface PortfolioValue {
  totalUSD: number;
  stxUSD: number;
  otherUSD: number;
  stxBalance: number;
  stxHumanBalance: number;
  stxPrice: number;
  stxChange24h: number;
  geckoTokens: { geckoId: string; humanBalance: number }[];
  fixedTokens: { contractName: string; humanBalance: number; fixedUsdPrice: number }[];
  fixedValueUSD: number;
}

export async function getPortfolioValue(address: string): Promise<PortfolioValue> {
  const [balanceData, stxPriceData] = await Promise.all([
    getFungibleTokens(address),
    getSTXPrice(),
  ]);

  const stxBalance = Number(balanceData.stx?.balance ?? 0);
  const stxUSD = (stxBalance / 1_000_000) * stxPriceData.usd;

  const geckoTokens: { geckoId: string; humanBalance: number; decimals: number }[] = [];
  const fixedTokens: { contractName: string; humanBalance: number; fixedUsdPrice: number }[] = [];
  let otherUSD = 0;
  let fixedValueUSD = 0;

  if (balanceData.fungible_tokens) {
    for (const [contractId, info] of Object.entries(
      balanceData.fungible_tokens as Record<string, { balance: string }>
    )) {
      const contractName = contractId.split(".")[1]?.split("::")[0];
      const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
      const balance = Number(info.balance);
      if (!known || balance <= 0) continue;

      const humanBalance = balance / Math.pow(10, known.decimals);

      if (known.fixedUsdPrice != null) {
        const usd = humanBalance * known.fixedUsdPrice;
        otherUSD += usd;
        fixedValueUSD += usd;
        fixedTokens.push({ contractName, humanBalance, fixedUsdPrice: known.fixedUsdPrice });
      } else if (known.geckoId) {
        geckoTokens.push({ geckoId: known.geckoId, humanBalance, decimals: known.decimals });
      }
    }
  }

  if (geckoTokens.length > 0) {
    try {
      const geckoIds = [...new Set(geckoTokens.map((t) => t.geckoId))].join(",");
      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=${geckoIds}&vs_currencies=usd`,
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
      );
      if (res.ok) {
        const prices = await res.json();
        for (const { geckoId, humanBalance } of geckoTokens) {
          otherUSD += humanBalance * (prices[geckoId]?.usd ?? 0);
        }
      }
    } catch (err) { console.error("[getPortfolioValue] CoinGecko price fetch failed:", err) }
  }

  const stxHumanBalance = stxBalance / 1_000_000;

  return {
    totalUSD: stxUSD + otherUSD,
    stxUSD,
    otherUSD,
    stxBalance,
    stxHumanBalance,
    stxPrice: stxPriceData.usd,
    stxChange24h: stxPriceData.usd_24h_change,
    geckoTokens: geckoTokens.map(({ geckoId, humanBalance }) => ({ geckoId, humanBalance })),
    fixedTokens,
    fixedValueUSD,
  };
}

interface TxWithTransfers {
  tx: { tx_status: string; block_time: number; fee_rate?: string };
  stx_sent: string;
  stx_received: string;
  ft_transfers: {
    asset_identifier: string; // e.g. "SP...usdcx::usdcx-token"
    sender: string | null;
    recipient: string | null;
    amount: string;
  }[];
}

async function fetchTransactionsInWindow(address: string, days: number): Promise<TxWithTransfers[]> {
  const cutoffSec = Date.now() / 1000 - days * 86400;
  const all: TxWithTransfers[] = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${HIRO_API_BASE}/extended/v1/address/${address}/transactions_with_transfers?limit=50&offset=${offset}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) break;
    const data = await res.json();
    const results: TxWithTransfers[] = data.results ?? [];
    if (results.length === 0) break;

    let reachedOld = false;
    for (const item of results) {
      if (item.tx.tx_status !== "success") continue;
      if ((item.tx.block_time ?? 0) < cutoffSec) { reachedOld = true; break; }
      all.push(item);
    }

    if (reachedOld || results.length < 50) break;
    offset += 50;
  }

  return all;
}

export async function getPortfolioHistory(
  address: string,
  portfolio: Pick<PortfolioValue, "stxHumanBalance" | "geckoTokens" | "fixedTokens">,
  days: number
): Promise<{ date: string; value: number }[]> {
  try {
    const geckoIds = [...new Set(portfolio.geckoTokens.map((t) => t.geckoId))];

    const intervalParam = days === 1 ? "" : "&interval=daily";

    // Fetch price histories + transaction history in parallel
    const [stxRes, ...rest] = await Promise.allSettled([
      fetch(`${COINGECKO_API}/coins/blockstack/market_chart?vs_currency=usd&days=${days}${intervalParam}`),
      ...geckoIds.map((id) =>
        fetch(`${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}${intervalParam}`)
      ),
      fetchTransactionsInWindow(address, days),
    ]);

    if (stxRes.status !== "fulfilled" || !stxRes.value.ok) return [];
    const rawStxPrices: [number, number][] = (await stxRes.value.json()).prices ?? [];

    // For 1D: deduplicate to one point per 4-hour bucket
    const sample4h = (prices: [number, number][]): [number, number][] => {
      const seen = new Set<number>();
      return prices.filter(([ts]) => {
        const bucket = Math.floor(new Date(ts).getHours() / 4);
        if (seen.has(bucket)) return false;
        seen.add(bucket);
        return true;
      });
    };
    const stxPrices = days === 1 ? sample4h(rawStxPrices) : rawStxPrices;

    // Parse token price maps (date → price)
    const tokenPriceMaps = new Map<string, Map<string, number>>();
    for (let i = 0; i < geckoIds.length; i++) {
      const res = rest[i] as PromiseSettledResult<Response>;
      if (res.status !== "fulfilled" || !res.value.ok) continue;
      const map = new Map<string, number>();
      for (const [ts, price] of (await res.value.json()).prices as [number, number][]) {
        map.set(new Date(ts).toISOString().slice(0, 10), price);
      }
      tokenPriceMaps.set(geckoIds[i], map);
    }

    // Parse transaction history to build net-change maps per day
    const txRes = rest[geckoIds.length];
    const txList: TxWithTransfers[] = txRes.status === "fulfilled"
      ? (txRes.value as TxWithTransfers[])
      : [];

    const add = (map: Map<string, number>, key: string, delta: number) =>
      map.set(key, (map.get(key) ?? 0) + delta);

    // stxChanges[dateKey] = net STX change (human STX)
    const stxChanges = new Map<string, number>();
    // tokenChanges[geckoId][dateKey] = net token change
    const tokenChanges = new Map<string, Map<string, number>>();
    // fixedChanges[contractName][dateKey] = net fixed-token change
    const fixedChanges = new Map<string, Map<string, number>>();

    for (const item of txList) {
      const dateKey = new Date(item.tx.block_time * 1000).toISOString().slice(0, 10);

      // STX: use stx_sent / stx_received (covers token_transfer + fees)
      const stxNet = (Number(item.stx_received) - Number(item.stx_sent)) / 1_000_000;
      if (stxNet !== 0) add(stxChanges, dateKey, stxNet);

      // Fungible token transfers (handles mint, burn, transfer — all event types)
      for (const ft of item.ft_transfers ?? []) {
        // asset_identifier: "SP...address.contract-name::asset-name"
        const contractName = ft.asset_identifier.split(".")[1]?.split("::")[0];
        if (!contractName) continue;
        const known = CONTRACT_NAME_TO_GECKO[contractName];
        if (!known) continue;

        const humanAmount = Number(ft.amount) / Math.pow(10, known.decimals);

        if (known.geckoId) {
          if (!tokenChanges.has(known.geckoId)) tokenChanges.set(known.geckoId, new Map());
          const m = tokenChanges.get(known.geckoId)!;
          if (ft.recipient === address) add(m, dateKey, +humanAmount);
          if (ft.sender === address) add(m, dateKey, -humanAmount);
        } else if (known.fixedUsdPrice != null) {
          if (!fixedChanges.has(contractName)) fixedChanges.set(contractName, new Map());
          const m = fixedChanges.get(contractName)!;
          if (ft.recipient === address) add(m, dateKey, +humanAmount);
          if (ft.sender === address) add(m, dateKey, -humanAmount);
        }
      }
    }

    // Helper: reconstruct balance at a given timestamp by undoing future changes
    function balanceAt(current: number, changeMap: Map<string, number>, ts: number): number {
      let bal = current;
      for (const [d, delta] of changeMap) {
        if (new Date(d).getTime() > ts) bal -= delta;
      }
      return Math.max(0, bal);
    }

    // Helper: nearest price lookup with 3-day fallback
    function priceAt(map: Map<string, number> | undefined, dateKey: string, ts: number): number {
      if (!map) return 0;
      let p = map.get(dateKey) ?? 0;
      for (let d = 1; d <= 3 && !p; d++) {
        p = map.get(new Date(ts - d * 86400000).toISOString().slice(0, 10)) ?? 0;
      }
      return p;
    }

    return stxPrices.map(([timestamp, stxPrice]) => {
      const dateKey = new Date(timestamp).toISOString().slice(0, 10);

      const stxBal = balanceAt(portfolio.stxHumanBalance, stxChanges, timestamp);
      let total = stxPrice * stxBal;

      for (const { geckoId, humanBalance } of portfolio.geckoTokens) {
        const tokenBal = balanceAt(humanBalance, tokenChanges.get(geckoId) ?? new Map(), timestamp);
        total += priceAt(tokenPriceMaps.get(geckoId), dateKey, timestamp) * tokenBal;
      }

      for (const { contractName, humanBalance, fixedUsdPrice } of portfolio.fixedTokens) {
        const fixedBal = balanceAt(humanBalance, fixedChanges.get(contractName) ?? new Map(), timestamp);
        total += fixedBal * fixedUsdPrice;
      }

      return {
        date: days === 1
          ? new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: undefined, hour12: true })
          : new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(total * 100) / 100,
      };
    });
  } catch (err) {
    console.error("[getPortfolioHistory] failed:", err);
    return [];
  }
}

export async function getTrendingTokens(): Promise<TrendingToken[]> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&category=stacks-ecosystem&order=market_cap_desc&per_page=50&sparkline=true&price_change_percentage=24h`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error("CoinGecko trending error");
    const data = await res.json();

    type CoinMarket = {
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_percentage_24h: number;
      image: string;
      sparkline_in_7d: { price: number[] };
    };

    return (data as CoinMarket[])
      .filter((t) => t.price_change_percentage_24h != null)
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        symbol: t.symbol.toUpperCase(),
        name: t.name,
        priceUsd: t.current_price ?? 0,
        change24h: t.price_change_percentage_24h ?? 0,
        image: t.image ?? "",
        sparkline: t.sparkline_in_7d?.price ?? [],
      }));
  } catch (err) {
    console.error("[getTrendingTokens] failed:", err);
    return [];
  }
}

export async function getTokenMetadata(contractId: string): Promise<{ name?: string; symbol?: string; image_uri?: string; decimals?: number } | null> {
  try {
    // contractId may include "::token-name" — strip it
    const cleanId = contractId.split("::")[0];
    const res = await fetch(
      `${HIRO_API_BASE}/metadata/v1/ft/${cleanId}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("[getTokenMetadata] failed:", err);
    return null;
  }
}

export async function getSTXBalance(address: string) {
  const res = await fetch(
    `${HIRO_API_BASE}/v2/accounts/${address}?proof=0`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error("Failed to fetch STX balance");
  return res.json();
}

export async function getFungibleTokens(address: string) {
  const res = await fetch(
    `${HIRO_API_BASE}/extended/v1/address/${address}/balances`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error("Failed to fetch token balances");
  return res.json();
}

export async function getTransactions(address: string, limit = 10, offset = 0) {
  const res = await fetch(
    `${HIRO_API_BASE}/extended/v2/addresses/${address}/transactions?limit=${limit}&offset=${offset}`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

// ─── Connected Apps ───────────────────────────────────────────────────────────

interface ProtocolInfo {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
}

// Keys are deployer principal addresses (the part before "." in a contract ID).
// Any contract deployed by that principal is attributed to that protocol.
const PROTOCOL_REGISTRY: Record<string, ProtocolInfo> = {
  "SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY": {
    name: "Bitflow",
    logoUrl: "https://bitflow.finance/favicon.ico",
    url: "https://bitflow.finance",
    category: "DEX",
  },
  "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM": {
    name: "ALEX",
    logoUrl: "https://alexgo.io/favicon.ico",
    url: "https://app.alexgo.io",
    category: "DEX / Lending",
  },
  "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR": {
    name: "Arkadiko",
    logoUrl: "https://arkadiko.finance/favicon.ico",
    url: "https://app.arkadiko.finance",
    category: "CDP",
  },
  "SP1NQBQ82XF7BRFM5DNZ62NRQPJGDPK9ZC3Q9S07J": {
    name: "Zest Protocol",
    logoUrl: "https://www.zestprotocol.com/favicon.ico",
    url: "https://www.zestprotocol.com",
    category: "Lending",
  },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG": {
    name: "StackingDAO",
    logoUrl: "https://stackingdao.com/favicon.ico",
    url: "https://stackingdao.com",
    category: "Liquid Staking",
  },
  "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1": {
    name: "Velar",
    logoUrl: "https://www.velar.co/favicon.ico",
    url: "https://app.velar.co",
    category: "DEX",
  },
  "SM3KNVZS30WM7F89SXKVVFY4SN9RMPZZ9FX929DZT": {
    name: "Lisa",
    logoUrl: "https://lisa.finance/favicon.ico",
    url: "https://lisa.finance",
    category: "Liquid Staking",
  },
};

export interface KnownProtocol {
  contractId: string;
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
}

export interface UnknownContract {
  contractId: string;
  lastInteractedAt: number;
}

export interface ConnectedAppsResult {
  knownProtocols: KnownProtocol[];
  unknownContracts: UnknownContract[];
}

export async function getConnectedApps(address: string): Promise<ConnectedAppsResult> {
  const data = await getTransactions(address, 50);
  const txs = (data.results ?? []) as Record<string, unknown>[];

  // Map contractId → most recent block_time for deduplication
  const seenContracts = new Map<string, number>();

  for (const item of txs) {
    const tx = (item.tx ?? item) as Record<string, unknown>;
    if (tx.tx_type !== "contract_call") continue;
    if (tx.tx_status !== "success") continue;
    const contractCall = tx.contract_call as Record<string, unknown> | undefined;
    const contractId = contractCall?.contract_id as string | undefined;
    if (!contractId) continue;
    const blockTime = (tx.block_time as number) ?? 0;
    const existing = seenContracts.get(contractId);
    if (existing === undefined || blockTime > existing) {
      seenContracts.set(contractId, blockTime);
    }
  }

  const knownProtocols: KnownProtocol[] = [];
  const unknownContracts: UnknownContract[] = [];
  const deployerMaxTime = new Map<string, number>();

  for (const [contractId, lastInteractedAt] of seenContracts) {
    const deployer = contractId.split(".")[0];
    const info = PROTOCOL_REGISTRY[deployer];
    if (info) {
      const prev = deployerMaxTime.get(deployer) ?? 0;
      if (prev === 0) {
        knownProtocols.push({ contractId, ...info, lastInteractedAt });
      } else if (lastInteractedAt > prev) {
        const entry = knownProtocols.find((p) => p.contractId.split(".")[0] === deployer);
        if (entry) entry.lastInteractedAt = lastInteractedAt;
      }
      deployerMaxTime.set(deployer, Math.max(prev, lastInteractedAt));
    } else {
      unknownContracts.push({ contractId, lastInteractedAt });
    }
  }

  return { knownProtocols, unknownContracts };
}

// ─── sBTC ─────────────────────────────────────────────────────────────────────

const SBTC_CONTRACT_NAME = "sbtc-token";

export interface SBTCPegStatus {
  btcPrice: number;
  sbtcPrice: number;
  deviation: number;
  status: "pegged" | "slight" | "depegged";
}

export interface SBTCBridgeTx {
  txId: string;
  direction: "deposit" | "withdrawal" | "transfer";
  amount: number;
  timestamp: number;
  txStatus: "success" | "pending" | "failed";
  counterpart?: string;
  fnName?: string;
}

export interface SBTCData {
  balance: number;
  valueUsd: number;
  peg: SBTCPegStatus;
  bridgeHistory: SBTCBridgeTx[];
}

export async function getSBTCData(address: string): Promise<SBTCData> {
  const [balanceData, priceData, txData] = await Promise.all([
    getFungibleTokens(address),
    fetch(
      `${COINGECKO_API}/simple/price?ids=bitcoin,sbtc-2&vs_currencies=usd`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    ).then((r) => r.json()),
    fetch(
      `${HIRO_API_BASE}/extended/v1/address/${address}/transactions_with_transfers?limit=50`,
      { signal: AbortSignal.timeout(10_000) }
    ).then((r) => r.json()),
  ]);

  // Balance
  const sbtcEntry = Object.entries(
    (balanceData.fungible_tokens as Record<string, { balance: string }>) ?? {}
  ).find(([id]) => id.split(".")[1]?.split("::")[0] === SBTC_CONTRACT_NAME);
  const balanceSats = sbtcEntry ? Number(sbtcEntry[1].balance) : 0;
  const balance = balanceSats / 1e8;

  // Peg
  const btcPrice: number = priceData?.bitcoin?.usd ?? 0;
  const sbtcPrice: number = priceData?.["sbtc-2"]?.usd ?? btcPrice;
  const deviation = btcPrice > 0 ? ((sbtcPrice - btcPrice) / btcPrice) * 100 : 0;
  const pegStatus: SBTCPegStatus["status"] =
    Math.abs(deviation) < 0.5 ? "pegged" : Math.abs(deviation) < 2 ? "slight" : "depegged";

  // Bridge history
  const bridgeHistory: SBTCBridgeTx[] = [];
  for (const item of (txData.results ?? []) as Record<string, unknown>[]) {
    const tx = (item.tx ?? item) as Record<string, unknown>;
    const ftTransfers = (item.ft_transfers ?? []) as Record<string, unknown>[];
    const sbtcFTs = ftTransfers.filter((ft) =>
      (ft.asset_identifier as string)?.includes(SBTC_CONTRACT_NAME)
    );
    if (sbtcFTs.length === 0) continue;

    const fnName = ((tx.contract_call as Record<string, string>)?.function_name ?? "").toLowerCase();
    const txStatus =
      tx.tx_status === "success" ? "success" : tx.tx_status === "pending" ? "pending" : "failed";

    for (const ft of sbtcFTs) {
      const amount = Number(ft.amount as string) / 1e8;
      const senderIsContract = (ft.sender as string)?.includes(".");
      const recipientIsContract = (ft.recipient as string)?.includes(".");

      let direction: SBTCBridgeTx["direction"];
      if (fnName.includes("deposit") || fnName.includes("complete")) {
        direction = "deposit";
      } else if (fnName.includes("withdraw") || fnName.includes("initiate")) {
        direction = "withdrawal";
      } else if (senderIsContract && !recipientIsContract) {
        direction = "deposit";
      } else if (!senderIsContract && recipientIsContract) {
        direction = "withdrawal";
      } else {
        direction = "transfer";
      }

      bridgeHistory.push({
        txId: tx.tx_id as string,
        direction,
        amount,
        timestamp: (tx.block_time as number) ?? 0,
        txStatus: txStatus as SBTCBridgeTx["txStatus"],
        counterpart:
          ft.sender === address ? (ft.recipient as string) : (ft.sender as string),
        fnName: (tx.contract_call as Record<string, string>)?.function_name,
      });
    }
  }

  return {
    balance,
    valueUsd: balance * (sbtcPrice || btcPrice),
    peg: { btcPrice, sbtcPrice, deviation, status: pegStatus },
    bridgeHistory,
  };
}

// ─── Stacking ─────────────────────────────────────────────────────────────────

export interface StackingStatus {
  isStacking: boolean;
  lockedSTX: number;
  lockedUstx: number;
  lockedUsd: number;
  burnchainUnlockHeight: number;
  blocksUntilUnlock: number;
  estimatedUnlockDays: number;
  cyclesRemaining: number;
  currentCycleId: number;
  cycleProgress: number;
  blocksUntilCycleEnd: number;
  rewardPhaseLength: number;
  totalStackedUstx: number;
  networkShare: number;
  minThresholdSTX: number;
  blocksUntilNextCycle: number;
  lockTxId: string;
}

export async function getStackingStatus(address: string): Promise<StackingStatus> {
  const [balanceData, poxData, stxPrice] = await Promise.all([
    getFungibleTokens(address),
    fetch(`${HIRO_API_BASE}/v2/pox`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()),
    getSTXPrice(),
  ]);

  const stx = balanceData.stx ?? {};
  const lockedUstx = Number(stx.locked ?? 0);
  const burnchainUnlockHeight = stx.burnchain_unlock_height ?? 0;
  const lockTxId = stx.lock_tx_id ?? "";

  const currentBlock: number = poxData.current_burnchain_block_height;
  const rewardPhaseLength: number = poxData.reward_phase_block_length;
  const preparePhaseLength: number = poxData.prepare_phase_block_length;
  const cycleLength = rewardPhaseLength + preparePhaseLength;
  const currentCycleId: number = poxData.current_cycle.id;
  const totalStackedUstx: number = poxData.current_cycle.stacked_ustx;
  const blocksUntilCycleEnd: number = poxData.next_cycle.blocks_until_prepare_phase;
  const blocksUntilNextCycle: number = poxData.next_cycle.blocks_until_reward_phase;
  const minThresholdSTX = (poxData.current_cycle.min_threshold_ustx ?? 0) / 1_000_000;

  const lockedSTX = lockedUstx / 1_000_000;
  const lockedUsd = lockedSTX * stxPrice.usd;
  const blocksUntilUnlock = Math.max(0, burnchainUnlockHeight - currentBlock);
  const estimatedUnlockDays = Math.round((blocksUntilUnlock * 10) / (60 * 24));
  const cyclesRemaining = blocksUntilUnlock > 0 ? Math.ceil(blocksUntilUnlock / cycleLength) : 0;
  const cycleProgress = Math.max(
    0,
    Math.min(100, ((rewardPhaseLength - blocksUntilCycleEnd) / rewardPhaseLength) * 100)
  );
  const networkShare = totalStackedUstx > 0 ? (lockedUstx / totalStackedUstx) * 100 : 0;

  return {
    isStacking: lockedUstx > 0,
    lockedSTX,
    lockedUstx,
    lockedUsd,
    burnchainUnlockHeight,
    blocksUntilUnlock,
    estimatedUnlockDays,
    cyclesRemaining,
    currentCycleId,
    cycleProgress,
    blocksUntilCycleEnd,
    rewardPhaseLength,
    totalStackedUstx,
    networkShare,
    minThresholdSTX,
    blocksUntilNextCycle,
    lockTxId,
  };
}

export interface TokenWithValue {
  contractId: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  imageUri?: string;
  priceUsd: number;
  valueUsd: number;
  change24h: number | null;
  warning?: "unverified" | "suspicious";
}

export async function getTokensWithValues(address: string): Promise<{
  stx: TokenWithValue;
  tokens: TokenWithValue[];
  totalUsd: number;
}> {
  const STX_IMAGE =
    "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png";

  const [balanceData, stxPrice] = await Promise.all([
    getFungibleTokens(address),
    getSTXPrice(),
  ]);

  const stxHumanBalance = Number(balanceData.stx?.balance ?? 0) / 1_000_000;
  const stxUsd = stxHumanBalance * stxPrice.usd;

  const rawTokens = Object.entries(
    (balanceData.fungible_tokens as Record<string, { balance: string }>) ?? {}
  )
    .map(([contractId, info]) => ({ contractId, rawBalance: Number(info.balance) }))
    .filter((t) => t.rawBalance > 0);

  const metadataResults = await Promise.allSettled(
    rawTokens.map((t) => getTokenMetadata(t.contractId))
  );

  const geckoIds = new Set<string>();
  for (const { contractId } of rawTokens) {
    const contractName = contractId.split(".")[1]?.split("::")[0];
    const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
    if (known?.geckoId) geckoIds.add(known.geckoId);
  }

  let geckoPrices: Record<string, { usd: number; usd_24h_change: number }> = {};
  if (geckoIds.size > 0) {
    try {
      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=${[...geckoIds].join(",")}&vs_currencies=usd&include_24hr_change=true`,
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
      );
      if (res.ok) geckoPrices = await res.json();
    } catch (err) { console.error("[getTokensWithValues] CoinGecko price fetch failed:", err) }
  }

  let otherUsd = 0;
  const tokens: TokenWithValue[] = rawTokens
    .map((t, i) => {
      const meta =
        metadataResults[i].status === "fulfilled" ? metadataResults[i].value : null;
      const contractName = t.contractId.split(".")[1]?.split("::")[0] ?? "";
      const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
      const decimals = meta?.decimals ?? known?.decimals ?? 6;
      const humanBalance = t.rawBalance / Math.pow(10, decimals);

      let priceUsd = 0;
      let change24h: number | null = null;
      if (known?.fixedUsdPrice != null) {
        priceUsd = known.fixedUsdPrice;
      } else if (known?.geckoId && geckoPrices[known.geckoId]) {
        priceUsd = geckoPrices[known.geckoId].usd ?? 0;
        change24h = geckoPrices[known.geckoId].usd_24h_change ?? null;
      }

      const valueUsd = humanBalance * priceUsd;
      otherUsd += valueUsd;

      // Warning detection
      // "suspicious": no Hiro metadata (likely spam airdrop) OR has metadata but no image + no price
      // "unverified": has metadata + image but not in our known list (no price)
      let warning: TokenWithValue["warning"];
      if (!known) {
        if (!meta || (!meta.image_uri && priceUsd === 0)) {
          warning = "suspicious";
        } else if (priceUsd === 0) {
          warning = "unverified";
        }
      }

      return {
        contractId: t.contractId,
        symbol: (meta?.symbol ?? contractName).toUpperCase().slice(0, 8),
        name: meta?.name ?? contractName,
        balance: humanBalance,
        decimals,
        imageUri: meta?.image_uri ?? undefined,
        priceUsd,
        valueUsd,
        change24h,
        warning,
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const stxToken: TokenWithValue = {
    contractId: "",
    symbol: "STX",
    name: "Stacks",
    balance: stxHumanBalance,
    decimals: 6,
    imageUri: STX_IMAGE,
    priceUsd: stxPrice.usd,
    valueUsd: stxUsd,
    change24h: stxPrice.usd_24h_change,
  };

  return { stx: stxToken, tokens, totalUsd: stxUsd + otherUsd };
}

export async function getSTXPrice(): Promise<{ usd: number; usd_24h_change: number }> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=blockstack&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const data = await res.json();
    return {
      usd: data.blockstack?.usd ?? 0,
      usd_24h_change: data.blockstack?.usd_24h_change ?? 0,
    };
  } catch (err) {
    console.error("[getSTXPrice] failed:", err);
    return { usd: 0, usd_24h_change: 0 };
  }
}

export interface STXMarketStats {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

export async function getSTXMarketStats(): Promise<STXMarketStats> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/blockstack?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const data = await res.json();
    return {
      price: data.market_data?.current_price?.usd ?? 0,
      change24h: data.market_data?.price_change_percentage_24h ?? 0,
      marketCap: data.market_data?.market_cap?.usd ?? 0,
      volume24h: data.market_data?.total_volume?.usd ?? 0,
    };
  } catch (err) {
    console.error("[getSTXMarketStats] failed:", err);
    return { price: 0, change24h: 0, marketCap: 0, volume24h: 0 };
  }
}

export interface STXMarketHistory {
  prices: number[];
  marketCaps: number[];
  volumes: number[];
}

export async function getSTXMarketHistory(days = 7): Promise<STXMarketHistory> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/blockstack/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error("CoinGecko history error");
    const data = await res.json();
    return {
      prices: (data.prices as [number, number][]).map(([, v]) => v),
      marketCaps: (data.market_caps as [number, number][]).map(([, v]) => v),
      volumes: (data.total_volumes as [number, number][]).map(([, v]) => v),
    };
  } catch (err) {
    console.error("[getSTXMarketHistory] failed:", err);
    return { prices: [], marketCaps: [], volumes: [] };
  }
}

export async function getSTXPriceHistory(days = 7): Promise<{ date: string; value: number }[]> {
  try {
    const intervalParam = days === 1 ? "" : "&interval=daily";
    const res = await fetch(
      `${COINGECKO_API}/coins/blockstack/market_chart?vs_currency=usd&days=${days}${intervalParam}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error("CoinGecko history error");
    const data = await res.json();
    const rawPrices: [number, number][] = data.prices ?? [];

    const prices = days === 1
      ? (() => {
          const seen = new Set<number>();
          return rawPrices.filter(([ts]) => {
            const bucket = Math.floor(new Date(ts).getHours() / 4);
            if (seen.has(bucket)) return false;
            seen.add(bucket);
            return true;
          });
        })()
      : rawPrices;

    return prices.map(([timestamp, price]) => ({
      date: days === 1
        ? new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
        : new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: price,
    }));
  } catch (err) {
    console.error("[getSTXPriceHistory] failed:", err);
    return [];
  }
}

// ─── PnL Tracker ──────────────────────────────────────────────────────────────

export interface PnLEntry {
  contractId: string;
  symbol: string;
  name: string;
  imageUri?: string;
  currentBalance: number;
  currentPrice: number;
  currentValue: number;
  avgCostBasis: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPct: number;
  realizedPnL: number;
  totalPnL: number;
}

export interface PnLData {
  entries: PnLEntry[];
  totalUnrealized: number;
  totalRealized: number;
  totalPnL: number;
}

async function fetchAllTransactions(address: string): Promise<TxWithTransfers[]> {
  const MAX_PAGES = 20;
  const LIMIT = 50;
  const all: TxWithTransfers[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `${HIRO_API_BASE}/extended/v1/address/${address}/transactions_with_transfers?limit=${LIMIT}&offset=${page * LIMIT}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) break;
      const data = await res.json();
      const results: TxWithTransfers[] = data.results ?? [];
      if (results.length === 0) break;
      for (const item of results) {
        if (item.tx.tx_status === "success") all.push(item);
      }
      if (results.length < LIMIT) break;
    } catch (err) {
      console.error("[fetchAllTransactions] page fetch failed:", err);
      break;
    }
  }

  return all;
}

export async function getPnLData(address: string): Promise<PnLData> {
  const [txList, holdings] = await Promise.all([
    fetchAllTransactions(address),
    getTokensWithValues(address),
  ]);

  // Collect geckoIds to fetch price history for
  const geckoIds: string[] = ["blockstack"]; // STX always included
  for (const token of holdings.tokens) {
    const contractName = token.contractId.split("::")[0].split(".")[1];
    const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
    if (known?.geckoId && !geckoIds.includes(known.geckoId)) {
      geckoIds.push(known.geckoId);
    }
  }

  // Fetch 365-day daily price history for each token
  const priceHistoryResults = await Promise.allSettled(
    geckoIds.map((id) =>
      fetch(`${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`)
        .then((r) => r.json())
    )
  );

  // Build Map<geckoId, Map<"YYYY-MM-DD", price>>
  const priceByDate = new Map<string, Map<string, number>>();
  for (let i = 0; i < geckoIds.length; i++) {
    const result = priceHistoryResults[i];
    if (result.status !== "fulfilled") continue;
    const map = new Map<string, number>();
    for (const [ts, price] of (result.value?.prices ?? []) as [number, number][]) {
      map.set(new Date(ts).toISOString().slice(0, 10), price);
    }
    priceByDate.set(geckoIds[i], map);
  }

  function getPriceAt(geckoId: string, blockTimeSec: number): number {
    const map = priceByDate.get(geckoId);
    if (!map) return 0;
    for (let delta = 0; delta <= 3; delta++) {
      const dateKey = new Date((blockTimeSec - delta * 86400) * 1000).toISOString().slice(0, 10);
      const p = map.get(dateKey);
      if (p) return p;
    }
    return 0;
  }

  // Per-token WAC state (key = normalized contractId without "::" suffix)
  interface TokenState {
    geckoId: string;
    totalUnits: number;
    totalCostBasis: number;
    realizedPnL: number;
  }
  const stateMap = new Map<string, TokenState>();
  stateMap.set("stx", { geckoId: "blockstack", totalUnits: 0, totalCostBasis: 0, realizedPnL: 0 });

  for (const token of holdings.tokens) {
    const normalizedId = token.contractId.split("::")[0];
    const contractName = normalizedId.split(".")[1];
    const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
    if (!known?.geckoId) continue;
    stateMap.set(normalizedId, { geckoId: known.geckoId, totalUnits: 0, totalCostBasis: 0, realizedPnL: 0 });
  }

  // Process transactions chronologically (oldest first)
  const sorted = [...txList].sort((a, b) => (a.tx.block_time ?? 0) - (b.tx.block_time ?? 0));

  for (const item of sorted) {
    const blockTime = item.tx.block_time ?? 0;

    // STX
    const stxReceived = Number(item.stx_received) / 1_000_000;
    const stxSent = Number(item.stx_sent) / 1_000_000;
    const stxNet = stxReceived - stxSent;
    if (stxNet !== 0) {
      const s = stateMap.get("stx")!;
      const price = getPriceAt("blockstack", blockTime);
      if (stxNet > 0) {
        s.totalCostBasis += stxNet * price;
        s.totalUnits += stxNet;
      } else {
        const sellUnits = Math.abs(stxNet);
        if (s.totalUnits > 0) {
          const avgCost = s.totalCostBasis / s.totalUnits;
          s.realizedPnL += sellUnits * (price - avgCost);
          s.totalCostBasis -= sellUnits * avgCost;
          s.totalUnits = Math.max(0, s.totalUnits - sellUnits);
        }
      }
    }

    // FT transfers
    for (const ft of item.ft_transfers ?? []) {
      const normalizedId = ft.asset_identifier.split("::")[0];
      const contractName = normalizedId.split(".")[1];
      const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
      if (!known?.geckoId) continue;

      const s = stateMap.get(normalizedId);
      if (!s) continue;

      const humanAmount = Number(ft.amount) / Math.pow(10, known.decimals);
      const price = getPriceAt(known.geckoId, blockTime);

      if (ft.recipient === address) {
        s.totalCostBasis += humanAmount * price;
        s.totalUnits += humanAmount;
      } else if (ft.sender === address) {
        if (s.totalUnits > 0) {
          const avgCost = s.totalCostBasis / s.totalUnits;
          s.realizedPnL += humanAmount * (price - avgCost);
          s.totalCostBasis -= humanAmount * avgCost;
          s.totalUnits = Math.max(0, s.totalUnits - humanAmount);
        }
      }
    }
  }

  // Build PnLEntry[]
  const entries: PnLEntry[] = [];

  // STX
  const stxState = stateMap.get("stx")!;
  const stxBalance = holdings.stx.balance;
  const stxAvgCost = stxState.totalUnits > 0 ? stxState.totalCostBasis / stxState.totalUnits : 0;
  const stxTotalCost = stxBalance * stxAvgCost;
  const stxUnrealized = holdings.stx.valueUsd - stxTotalCost;
  entries.push({
    contractId: "",
    symbol: "STX",
    name: "Stacks",
    imageUri: holdings.stx.imageUri,
    currentBalance: stxBalance,
    currentPrice: holdings.stx.priceUsd,
    currentValue: holdings.stx.valueUsd,
    avgCostBasis: stxAvgCost,
    totalCost: stxTotalCost,
    unrealizedPnL: stxUnrealized,
    unrealizedPct: stxTotalCost > 0 ? (stxUnrealized / stxTotalCost) * 100 : 0,
    realizedPnL: stxState.realizedPnL,
    totalPnL: stxUnrealized + stxState.realizedPnL,
  });

  // Other tokens
  for (const token of holdings.tokens) {
    const normalizedId = token.contractId.split("::")[0];
    const contractName = normalizedId.split(".")[1];
    const known = contractName ? CONTRACT_NAME_TO_GECKO[contractName] : null;
    if (!known?.geckoId) continue;

    const s = stateMap.get(normalizedId);
    if (!s) continue;

    const avgCost = s.totalUnits > 0 ? s.totalCostBasis / s.totalUnits : 0;
    const totalCost = token.balance * avgCost;
    const unrealized = token.valueUsd - totalCost;
    entries.push({
      contractId: token.contractId,
      symbol: token.symbol,
      name: token.name,
      imageUri: token.imageUri,
      currentBalance: token.balance,
      currentPrice: token.priceUsd,
      currentValue: token.valueUsd,
      avgCostBasis: avgCost,
      totalCost,
      unrealizedPnL: unrealized,
      unrealizedPct: totalCost > 0 ? (unrealized / totalCost) * 100 : 0,
      realizedPnL: s.realizedPnL,
      totalPnL: unrealized + s.realizedPnL,
    });
  }

  entries.sort((a, b) => b.currentValue - a.currentValue);

  const totalUnrealized = entries.reduce((s, e) => s + e.unrealizedPnL, 0);
  const totalRealized = entries.reduce((s, e) => s + e.realizedPnL, 0);

  return { entries, totalUnrealized, totalRealized, totalPnL: totalUnrealized + totalRealized };
}
