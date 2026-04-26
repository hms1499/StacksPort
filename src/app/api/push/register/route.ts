import { NextResponse } from 'next/server';
import { putSub, type PushAlertEntry, type SubEntry } from '@/lib/push-redis';

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

  const entry: SubEntry = {
    subscription,
    alerts,
    updatedAt: Date.now(),
  };
  await putSub(walletAddress, entry);

  return NextResponse.json({ ok: true });
}
