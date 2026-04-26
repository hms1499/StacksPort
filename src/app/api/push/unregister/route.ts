import { NextResponse } from 'next/server';
import { deleteSub } from '@/lib/push-redis';

interface Body {
  walletAddress: string;
}

export async function POST(request: Request) {
  const { walletAddress } = (await request.json()) as Body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
  }
  await deleteSub(walletAddress);
  return NextResponse.json({ ok: true });
}
