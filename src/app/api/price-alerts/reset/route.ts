import { NextRequest, NextResponse } from "next/server";
import { getSub, putSub } from "@/lib/push-redis";

// Clears triggeredAt and re-activates a single alert. The register endpoint
// can't do this because it preserves server-side triggered state to defend
// against stale client syncs. Resetting is an explicit user action and gets
// its own endpoint.

interface ResetBody {
  walletAddress: string;
  alertId: string;
}

export async function POST(req: NextRequest) {
  let body: ResetBody;
  try {
    body = (await req.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { walletAddress, alertId } = body;
  if (!walletAddress || !alertId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const sub = await getSub(walletAddress);
  if (!sub) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 });
  }

  let found = false;
  for (const a of sub.alerts) {
    if (a.id === alertId) {
      a.isActive = true;
      a.triggeredAt = undefined;
      a.lastPushedAt = null;
      found = true;
      break;
    }
  }

  if (!found) {
    return NextResponse.json({ error: "alert not found" }, { status: 404 });
  }

  sub.updatedAt = Date.now();
  await putSub(walletAddress, sub);

  return NextResponse.json({ ok: true });
}
