import { NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { getYieldSnapshot, type YieldSnapshot } from "@/lib/server/yield-snapshot";

const CACHE_KEY = "yield-snapshot:v1";
const CACHE_TTL_SECONDS = 600;
const CACHE_TAG = "yield";

export const revalidate = 0; // we manage caching ourselves

export async function GET() {
  const cache = getCache();
  const cached = (await cache.get(CACHE_KEY)) as YieldSnapshot | null;

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "x-stacksport-cache": "HIT",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  }

  const snapshot = await getYieldSnapshot();
  await cache.set(CACHE_KEY, snapshot, {
    ttl: CACHE_TTL_SECONDS,
    tags: [CACHE_TAG],
    name: "yield-snapshot",
  });

  return NextResponse.json(snapshot, {
    headers: {
      "x-stacksport-cache": "MISS",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
