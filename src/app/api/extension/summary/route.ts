import { NextRequest, NextResponse } from "next/server";

const COINGECKO = "https://api.coingecko.com/api/v3";
const HIRO = "https://api.hiro.so";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  try {
    // Prices: STX + BTC in one call
    const priceRes = await fetch(
      `${COINGECKO}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    const priceData = priceRes.ok ? await priceRes.json() : {};

    const prices = {
      stx: priceData?.blockstack?.usd ?? 0,
      btc: priceData?.bitcoin?.usd ?? 0,
      stxChange24h: priceData?.blockstack?.usd_24h_change ?? 0,
      btcChange24h: priceData?.bitcoin?.usd_24h_change ?? 0,
    };

    // Portfolio: only if address provided
    let portfolio = { totalUSD: 0, stxBalance: 0 };
    if (address) {
      const balRes = await fetch(
        `${HIRO}/extended/v1/address/${address}/balances`,
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        const stxMicro = Number(balData?.stx?.balance ?? 0);
        const stxBalance = stxMicro / 1_000_000;
        portfolio = {
          totalUSD: stxBalance * prices.stx,
          stxBalance,
        };
      }
    }

    return NextResponse.json({ prices, portfolio }, { headers: CORS });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500, headers: CORS }
    );
  }
}
