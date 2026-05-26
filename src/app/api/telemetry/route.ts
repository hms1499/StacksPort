import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

// Whitelist so a hostile client can't fill Redis with arbitrary keys.
const ALLOWED_EVENTS = new Set([
  "dashboard_viewed",
  "dashboard_edit_mode_on",
  "dashboard_edit_mode_off",
  "dashboard_layout_mutated",
  "dashboard_layout_reset",
]);

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

  const key = `telemetry:${event}:${today()}`;
  try {
    await redis.incr(key);
    await redis.expire(key, TTL_SECONDS);
  } catch {
    // Don't surface Redis errors to the client.
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}
