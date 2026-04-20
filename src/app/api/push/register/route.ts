import { NextResponse } from 'next/server';
import { readPushStore, writePushStore, type PushAlertEntry } from '@/lib/push-storage';

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

  const store = await readPushStore();
  store[walletAddress] = { subscription, alerts, updatedAt: Date.now() };
  await writePushStore(store);

  return NextResponse.json({ ok: true });
}
