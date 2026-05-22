import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import {
  getPortfolioSnapshot,
  isValidStacksAddress,
  type PortfolioSnapshot,
} from "@/lib/server/portfolio-snapshot";

const CACHE_TTL_SECONDS = 30;

function cacheKey(address: string) {
  return `portfolio:${address}:v1`;
}

function cacheTags(address: string) {
  return ["portfolio", `portfolio:${address}`];
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";

  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const cache = getCache();
  const key = cacheKey(address);
  const cached = (await cache.get(key)) as PortfolioSnapshot | null;

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "x-stacksport-cache": "HIT",
        "Cache-Control": "private, max-age=30",
      },
    });
  }

  const snapshot = await getPortfolioSnapshot(address);
  await cache.set(key, snapshot, {
    ttl: CACHE_TTL_SECONDS,
    tags: cacheTags(address),
    name: "portfolio-snapshot",
  });

  return NextResponse.json(snapshot, {
    headers: {
      "x-stacksport-cache": "MISS",
      "Cache-Control": "private, max-age=30",
    },
  });
}
