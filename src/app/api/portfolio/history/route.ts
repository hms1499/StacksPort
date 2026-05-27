import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { isValidStacksAddress } from "@/lib/server/portfolio-snapshot";
import {
  readHistory,
  type HistoryRange,
  type HistoryResult,
} from "@/lib/server/portfolio-history";

const CACHE_TTL_SECONDS = 60;
const VALID_RANGES: HistoryRange[] = ["24h", "7d", "30d", "all"];

function isValidRange(v: string): v is HistoryRange {
  return (VALID_RANGES as string[]).includes(v);
}

function cacheKey(address: string, range: HistoryRange) {
  return `portfolio:history:${address}:${range}:v1`;
}

// Tagged under the same per-address namespace as the snapshot so trackTx's
// /api/portfolio/invalidate call busts history too.
function cacheTags(address: string) {
  return ["portfolio", `portfolio:${address}`];
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const rangeParam = req.nextUrl.searchParams.get("range")?.trim() ?? "7d";

  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  if (!isValidRange(rangeParam)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }

  const cache = getCache();
  const key = cacheKey(address, rangeParam);
  const cached = (await cache.get(key)) as HistoryResult | null;

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "x-stacksport-cache": "HIT",
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const result = await readHistory(address, rangeParam);
  await cache.set(key, result, {
    ttl: CACHE_TTL_SECONDS,
    tags: cacheTags(address),
    name: "portfolio-history",
  });

  return NextResponse.json(result, {
    headers: {
      "x-stacksport-cache": "MISS",
      "Cache-Control": "private, max-age=60",
    },
  });
}
