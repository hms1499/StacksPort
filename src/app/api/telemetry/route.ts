import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  FUNNEL_EVENTS,
  lastNDates,
  assembleFunnel,
} from "@/lib/server/telemetry-funnel";

export const runtime = "nodejs";

// Whitelist so a hostile client can't fill Redis with arbitrary keys.
const ALLOWED_EVENTS = new Set([
  "dashboard_viewed",
  "dashboard_edit_mode_on",
  "dashboard_edit_mode_off",
  "dashboard_layout_mutated",
  "dashboard_layout_reset",
  "dashboard_widget_error",
  // Activation funnel
  "wallet_connected",
  "backtest_cta_clicked",
  "dca_plan_created",
  "swap_executed",
]);

const KEY_PREFIX = "telemetry:";

const TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let event: string | undefined;
  try {
    const body = (await request.json()) as { event?: unknown };
    event = typeof body.event === "string" ? body.event : undefined;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    // Fail open — telemetry is best-effort.
    return NextResponse.json({ ok: true, stored: false });
  }

  const key = `${KEY_PREFIX}${event}:${today()}`;
  try {
    await redis.incr(key);
    await redis.expire(key, TTL_SECONDS);
  } catch {
    // Don't surface Redis errors to the client.
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}

// GET /api/telemetry?days=30 → the activation funnel over the last N days.
// Returns per-event totals + a daily series. Aggregate counts only, no PII.
export async function GET(request: Request) {
  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days = Math.min(90, Math.max(1, Number.isFinite(daysParam) && daysParam > 0 ? Math.round(daysParam) : 30));
  const dates = lastNDates(days);

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ available: false, ...assembleFunnel(dates, new Map()) });
  }

  // One MGET over the events × dates grid keeps this to a single round-trip.
  const keys = dates.flatMap((d) => FUNNEL_EVENTS.map((e) => `${KEY_PREFIX}${e}:${d}`));
  let values: (number | string | null)[] = [];
  try {
    values = keys.length ? await redis.mget<(number | string | null)[]>(...keys) : [];
  } catch {
    return NextResponse.json({ available: false, ...assembleFunnel(dates, new Map()) });
  }

  const counts = new Map<string, number>();
  keys.forEach((k, i) => {
    const n = Number(values[i] ?? 0);
    if (n) counts.set(k.slice(KEY_PREFIX.length), n); // "<event>:<date>"
  });

  return NextResponse.json({ available: true, ...assembleFunnel(dates, counts) });
}
