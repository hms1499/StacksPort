import { NextResponse } from 'next/server';
import { getSub, putSub, type PushAlertEntry, type SubEntry } from '@/lib/push-redis';

interface RegisterBody {
  walletAddress: string;
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  // DCA plan IDs của user — dùng bởi keeper bot để reverse-lookup và gửi push khi execute
  planIds?: number[];
}

export async function POST(request: Request) {
  const body = await request.json() as RegisterBody;
  const { walletAddress, subscription, alerts, planIds } = body;

  if (!walletAddress || !subscription?.endpoint) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Preserve worker-written state across client syncs. The keeper-bot
  // evaluator owns lastPushedAt + triggeredAt + the fire-once isActive=false
  // transition. If a stale client tries to re-enable a fired alert, that has
  // to go through the explicit reset endpoint, not a register sync.
  const existing = await getSub(walletAddress);
  const existingById = new Map<string, PushAlertEntry>();
  if (existing) {
    for (const a of existing.alerts) existingById.set(a.id, a);
  }
  const mergedAlerts: PushAlertEntry[] = alerts.map((a) => {
    const prev = existingById.get(a.id);
    if (!prev) return a;
    return {
      ...a,
      lastPushedAt: prev.lastPushedAt ?? a.lastPushedAt ?? null,
      triggeredAt: prev.triggeredAt ?? a.triggeredAt,
      // Once fired, only an explicit reset (not a register sync) can flip back to active.
      isActive: prev.triggeredAt ? false : a.isActive,
    };
  });

  const entry: SubEntry = {
    subscription,
    alerts: mergedAlerts,
    // Preserve existing planIds nếu request không gửi lên (price alert sync không có planIds)
    planIds: planIds ?? existing?.planIds,
    updatedAt: Date.now(),
  };
  await putSub(walletAddress, entry);

  return NextResponse.json({ ok: true });
}
