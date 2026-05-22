import { NextResponse } from "next/server";
import { getKeeperHealth } from "@/lib/server/keeper-health";

// Designed to be pinged by an external uptime monitor (UptimeRobot,
// BetterStack, etc). HTTP 200 = healthy, 503 = degraded — most monitors
// page on non-2xx out of the box.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getKeeperHealth();
    return NextResponse.json(health, {
      status: health.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
