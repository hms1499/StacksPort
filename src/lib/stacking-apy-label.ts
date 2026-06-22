/**
 * APY label for the stacking row: live StackingDAO APY when known, otherwise
 * the hardcoded estimate range. Live value formatted to one decimal.
 */
export function stackingApyLabel(
  liveApy: number | undefined,
  estimateRange: [number, number]
): string {
  if (liveApy !== undefined) return `~${liveApy.toFixed(1)}%`;
  const [lo, hi] = estimateRange;
  return lo === hi ? `~${lo}%` : `${lo}–${hi}%`;
}
