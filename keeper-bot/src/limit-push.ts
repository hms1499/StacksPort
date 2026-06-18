// keeper-bot/src/limit-push.ts
// Pure trigger math for limit orders. Kept dependency-free so the unit test
// imports it without dragging in the broadcast/push machinery (which has
// VAPID/Redis side-effects). The orchestration lives in limit-run.ts.

export function shouldFill(order: { targetUsdMicro: number }, sbtcUsd: number): boolean {
  return sbtcUsd <= order.targetUsdMicro / 1_000_000;
}

export function computeMinOut(
  netUstx: number,
  quoteSbtcPerUstx: number,
  slippageBps: number
): number {
  if (!(quoteSbtcPerUstx > 0)) return 0;
  const expected = netUstx * quoteSbtcPerUstx;
  return Math.floor(expected * (1 - slippageBps / 10_000));
}

// sats of sBTC per uSTX, derived from USD prices:
//   net uSTX → USD (×stxUsd/1e6) → sBTC (÷btcUsd) → sats (×1e8)
//   ⇒ sats/uSTX = stxUsd / btcUsd × 100
export function satsPerUstx(stxUsd: number, btcUsd: number): number {
  if (!(btcUsd > 0)) return 0;
  return (stxUsd / btcUsd) * 100;
}
