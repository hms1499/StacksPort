import { NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { getMarketSnapshot, type MarketSnapshot } from "@/lib/server/market-snapshot";

const CACHE_KEY = "market-snapshot:v1";
const CACHE_TTL_SECONDS = 60;
const CACHE_TAG = "market";

export const revalidate = 0; // we manage caching ourselves

export async function GET() {
  const cache = getCache();
  const cached = (await cache.get(CACHE_KEY)) as MarketSnapshot | null;

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "x-stacksport-cache": "HIT",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }

  const snapshot = await getMarketSnapshot();
  await cache.set(CACHE_KEY, snapshot, {
    ttl: CACHE_TTL_SECONDS,
    tags: [CACHE_TAG],
    name: "market-snapshot",
  });

  return NextResponse.json(snapshot, {
    headers: {
      "x-stacksport-cache": "MISS",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
