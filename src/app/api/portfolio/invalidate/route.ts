import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { isValidStacksAddress } from "@/lib/server/portfolio-snapshot";
import { deleteCachedPortfolioInsights } from "@/lib/server/ai-insights-cache";

// Why: when a user's tx confirms on-chain, the cached snapshot (TTL 30s)
// is stale relative to the new balance/plan state. Bursting the tag forces
// the next read to recompute, so the dashboard updates within seconds
// instead of waiting out the TTL.
//
// Auth: none. The worst an attacker can do is force a single re-fetch per
// invalidation, which is bounded by the snapshot's own compute cost. If
// abuse appears in production, gate this behind a signed message from the
// wallet (the user already controls a Stacks key) or a sliding-window
// rate limit per IP.

export async function POST(req: NextRequest) {
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const address = body.address?.trim() ?? "";
  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const cache = getCache();
  await cache.expireTag(`portfolio:${address}`);

  // Personalized AI alerts are derived from the snapshot, so bust them too —
  // otherwise they'd stay stale for up to the 12-min TTL after a plan changes.
  await deleteCachedPortfolioInsights(address);

  return NextResponse.json({ ok: true });
}
