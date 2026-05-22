import { NextRequest, NextResponse } from "next/server";
import { getSub, type PushAlertEntry } from "@/lib/push-redis";

// Server is the source of truth for alert state (isActive, triggeredAt,
// lastPushedAt). Client hydrates from here on wallet connect, then mirrors
// any mutations through /api/push/register as before.

export const dynamic = "force-dynamic";

export interface AlertView extends PushAlertEntry {
  triggeredAt?: number;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!address) {
    return NextResponse.json({ alerts: [] satisfies AlertView[] });
  }

  try {
    const sub = await getSub(address);
    const alerts = (sub?.alerts ?? []) as AlertView[];
    return NextResponse.json(
      { alerts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Redis unavailable: surface as "no alerts" rather than 500 so the
    // client SWR hook treats it as a transient empty state.
    return NextResponse.json(
      { alerts: [] satisfies AlertView[] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
