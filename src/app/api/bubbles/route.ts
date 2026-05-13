import { NextResponse } from "next/server";

const COINGECKO = "https://api.coingecko.com/api/v3";

const STACKS_TOKEN_IDS = [
  "blockstack",
  "alexgo",
  "welshcorgicoin",
  "velar",
  "staked-stx",
];

export interface BubbleToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number;
  change24h: number;
  change7d: number;
  isStacks: boolean;
}

function mapCoin(
  coin: Record<string, unknown>,
  forceStacks = false
): BubbleToken {
  return {
    id: coin.id as string,
    symbol: (coin.symbol as string).toUpperCase(),
    name: coin.name as string,
    image: coin.image as string,
    price: (coin.current_price as number) ?? 0,
    marketCap: (coin.market_cap as number) ?? 0,
    volume24h: (coin.total_volume as number) ?? 0,
    change1h: (coin.price_change_percentage_1h_in_currency as number) ?? 0,
    change24h: (coin.price_change_percentage_24h as number) ?? 0,
    change7d: (coin.price_change_percentage_7d_in_currency as number) ?? 0,
    isStacks: forceStacks || STACKS_TOKEN_IDS.includes(coin.id as string),
  };
}

export async function GET() {
  try {
    const topRes = await fetch(
      `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=1h,7d`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!topRes.ok) {
      return NextResponse.json(
        { error: "CoinGecko error" },
        { status: topRes.status }
      );
    }

    const topCoins: Record<string, unknown>[] = await topRes.json();
    const tokens: BubbleToken[] = topCoins.map((c) => mapCoin(c));

    const presentIds = new Set(tokens.map((t) => t.id));
    const missingStacks = STACKS_TOKEN_IDS.filter(
      (id) => !presentIds.has(id)
    );

    if (missingStacks.length > 0) {
      const ids = missingStacks.join(",");
      const stacksRes = await fetch(
        `${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=1h,7d`,
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
      );
      if (stacksRes.ok) {
        const stacksCoins: Record<string, unknown>[] = await stacksRes.json();
        tokens.push(...stacksCoins.map((c) => mapCoin(c, true)));
      }
    }

    return NextResponse.json(tokens, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
