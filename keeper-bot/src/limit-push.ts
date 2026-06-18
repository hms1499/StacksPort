// keeper-bot/src/limit-push.ts
// Pure trigger math for limit orders. The run-step that ties these to
// getExecutableLimitOrders + a live pool quote + broadcast is wired in Task 16;
// keep these exports pure so they stay unit-testable.

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
