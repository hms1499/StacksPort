import type { ProtocolPosition } from "./protocol-positions";
import type { YieldSnapshot } from "./server/yield-snapshot";

export interface YieldEstimate {
  totalAtWork: number;
  annualYield: number | null;
}

function symbolOf(tokenAmount: string): string {
  const parts = tokenAmount.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

export function estimateAnnualYield(
  positions: Map<string, ProtocolPosition | null>,
  snap: YieldSnapshot | undefined
): YieldEstimate {
  let totalAtWork = 0;
  let yieldSum = 0;
  let hasApy = false;

  for (const [name, pos] of positions) {
    if (!pos) continue;
    totalAtWork += pos.totalUsd;
    if (!snap) continue;

    if (name === "StackingDAO" && snap.stackingApy !== null) {
      yieldSum += pos.totalUsd * (snap.stackingApy / 100);
      hasApy = true;
    } else if (name === "Zest Protocol") {
      for (const line of pos.lines) {
        const apy = snap.zest[symbolOf(line.tokenAmount)];
        if (typeof apy === "number") {
          yieldSum += line.usdValue * (apy / 100);
          hasApy = true;
        }
      }
    }
  }

  return { totalAtWork, annualYield: hasApy ? yieldSum : null };
}
