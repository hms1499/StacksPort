import { NextRequest, NextResponse } from "next/server";
import { premium } from "@/lib/smart-dca";

export const dynamic = "force-dynamic";

const CG = "https://api.coingecko.com/api/v3";

async function dailyUsd(coin: string, days: number): Promise<number[]> {
  const res = await fetch(
    `${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(10_000), next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`coingecko ${coin} ${res.status}`);
  const data = (await res.json()) as { prices: [number, number][] };
  return (data.prices ?? []).map(([, v]) => v);
}

// GET /api/dca/smart/signal?windowDays=7
export async function GET(req: NextRequest) {
  const windowDays = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("windowDays") ?? 7) || 7, 30));
  try {
    const [stx, btc] = await Promise.all([dailyUsd("blockstack", windowDays), dailyUsd("bitcoin", windowDays)]);
    const n = Math.min(stx.length, btc.length);
    const series: number[] = [];
    for (let i = 0; i < n; i++) if (btc[i] > 0) series.push((stx[i] / btc[i]) * 1e8);
    if (series.length === 0) return NextResponse.json({ signal: null });
    const current = series[series.length - 1];
    const avg = series.reduce((a, v) => a + v, 0) / series.length;
    return NextResponse.json(
      { signal: { current, sma: avg, premium: premium(current, avg) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ signal: null });
  }
}
