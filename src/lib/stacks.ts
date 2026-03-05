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
        { next: { revalidate: 60 } }
      );
      if (res.ok) {
        const prices = await res.json();
        for (const { geckoId, humanBalance } of geckoTokens) {
          otherUSD += humanBalance * (prices[geckoId]?.usd ?? 0);
        }
      }
    } catch { /* ignore */ }
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
      `${HIRO_API_BASE}/extended/v1/address/${address}/transactions_with_transfers?limit=50&offset=${offset}`
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

    // Fetch price histories + transaction history in parallel
    const [stxRes, ...rest] = await Promise.allSettled([
      fetch(`${COINGECKO_API}/coins/blockstack/market_chart?vs_currency=usd&days=${days}&interval=daily`),
      ...geckoIds.map((id) =>
        fetch(`${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
      ),
      fetchTransactionsInWindow(address, days),
    ]);

    if (stxRes.status !== "fulfilled" || !stxRes.value.ok) return [];
    const stxPrices: [number, number][] = (await stxRes.value.json()).prices ?? [];

    // Parse token price maps (date → price)
    const tokenPriceMaps = new Map<string, Map<string, number>>();
    for (let i = 0; i < geckoIds.length; i++) {
      const res = rest[i];
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
        date: new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(total * 100) / 100,
      };
    });
  } catch {
    return [];
  }
}

export async function getTrendingTokens(): Promise<TrendingToken[]> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&category=stacks-ecosystem&order=market_cap_desc&per_page=50&sparkline=true&price_change_percentage=24h`,
      { next: { revalidate: 60 } }
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
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        symbol: t.symbol.toUpperCase(),
        name: t.name,
        priceUsd: t.current_price ?? 0,
        change24h: t.price_change_percentage_24h ?? 0,
        image: t.image ?? "",
        sparkline: t.sparkline_in_7d?.price ?? [],
      }));
  } catch {
    return [];
  }
}

export async function getTokenMetadata(contractId: string): Promise<{ name?: string; symbol?: string; image_uri?: string; decimals?: number } | null> {
  try {
    // contractId may include "::token-name" — strip it
    const cleanId = contractId.split("::")[0];
    const res = await fetch(
      `${HIRO_API_BASE}/metadata/v1/ft/${cleanId}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getSTXBalance(address: string) {
  const res = await fetch(
    `${HIRO_API_BASE}/v2/accounts/${address}?proof=0`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error("Failed to fetch STX balance");
  return res.json();
}

export async function getFungibleTokens(address: string) {
  const res = await fetch(
    `${HIRO_API_BASE}/extended/v1/address/${address}/balances`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error("Failed to fetch token balances");
  return res.json();
}

export async function getTransactions(address: string, limit = 10) {
  const res = await fetch(
    `${HIRO_API_BASE}/extended/v2/addresses/${address}/transactions?limit=${limit}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function getSTXPrice(): Promise<{ usd: number; usd_24h_change: number }> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=blockstack&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const data = await res.json();
    return {
      usd: data.blockstack?.usd ?? 0,
      usd_24h_change: data.blockstack?.usd_24h_change ?? 0,
    };
  } catch {
    return { usd: 0, usd_24h_change: 0 };
  }
}

export async function getSTXPriceHistory(days = 7): Promise<{ date: string; value: number }[]> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/blockstack/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("CoinGecko history error");
    const data = await res.json();
    return (data.prices as [number, number][]).map(([timestamp, price]) => ({
      date: new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: price,
    }));
  } catch {
    return [];
  }
}
