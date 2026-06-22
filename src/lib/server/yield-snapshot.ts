import { fetchZestApy } from "./defillama-yields";
import { fetchStackingApy } from "./stackingdao-apy";

export interface YieldSnapshot {
  generatedAt: number;
  stackingApy: number | null;
  zest: Record<string, number>;
  sources: {
    stackingDao: "ok" | "unavailable";
    zest: "ok" | "unavailable";
  };
}

export function buildYieldSnapshot({
  stackingApy,
  zest,
  generatedAt = Date.now(),
}: {
  stackingApy: number | null;
  zest: Record<string, number> | null;
  generatedAt?: number;
}): YieldSnapshot {
  const zestMap = zest ?? {};
  return {
    generatedAt,
    stackingApy,
    zest: zestMap,
    sources: {
      stackingDao: stackingApy !== null ? "ok" : "unavailable",
      zest: Object.keys(zestMap).length > 0 ? "ok" : "unavailable",
    },
  };
}

export async function getYieldSnapshot(): Promise<YieldSnapshot> {
  const [stackingApy, zest] = await Promise.all([
    fetchStackingApy(),
    fetchZestApy(),
  ]);
  return buildYieldSnapshot({ stackingApy, zest });
}
