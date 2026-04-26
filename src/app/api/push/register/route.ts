import { NextResponse } from 'next/server';
import { getSub, putSub, type PushAlertEntry, type SubEntry } from '@/lib/push-redis';

interface RegisterBody {
  walletAddress: string;
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
}

export async function POST(request: Request) {
  const body = await request.json() as RegisterBody;
  const { walletAddress, subscription, alerts } = body;

  if (!walletAddress || !subscription?.endpoint) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Preserve worker-written lastPushedAt across syncs.
  // Frontend always sends lastPushedAt: null; merge from existing entry by alert id.
  const existing = await getSub(walletAddress);
  const existingByID = new Map<string, number | null>();
  if (existing) {
    for (const a of existing.alerts) existingByID.set(a.id, a.lastPushedAt ?? null);
  }
  const mergedAlerts: PushAlertEntry[] = alerts.map((a) => ({
    ...a,
    lastPushedAt: existingByID.has(a.id) ? existingByID.get(a.id)! : (a.lastPushedAt ?? null),
  }));

  const entry: SubEntry = {
    subscription,
    alerts: mergedAlerts,
    updatedAt: Date.now(),
  };
  await putSub(walletAddress, entry);

  return NextResponse.json({ ok: true });
}
