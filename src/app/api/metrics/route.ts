import { NextResponse } from "next/server";
import { hexToCV, ClarityType, type ClarityValue } from "@stacks/transactions";
import { DCA_CONTRACT_ADDRESS, DCA_CONTRACT_NAME } from "@/lib/dca";
import { DCA_SBTC_CONTRACT_ADDRESS, DCA_SBTC_CONTRACT_NAME } from "@/lib/dca-sbtc";

export const revalidate = 60;

const HIRO_API = "https://api.hiro.so";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
// Stacks burn/genesis address — accepted by Hiro for unauthenticated read-only calls
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

interface VaultStats {
  plans: number;
  volume: number;     // raw on-chain unit (uSTX or sats depending on vault)
  executed: number;
}

function unwrapStats(cv: ClarityValue): VaultStats {
  // Contract shape: (ok { total-plans: uint, total-volume: uint, total-executed: uint })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = cv as any;
  if (root.type !== ClarityType.ResponseOk) throw new Error("expected (ok …)");
  const tuple = root.value;
  if (tuple.type !== ClarityType.Tuple) throw new Error("expected tuple");
  const t = tuple.value as Record<string, { value: bigint }>;
  return {
    plans:    Number(t["total-plans"].value),
    volume:   Number(t["total-volume"].value),
    executed: Number(t["total-executed"].value),
  };
}

async function getStats(addr: string, name: string): Promise<VaultStats | null> {
  try {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${addr}/${name}/get-stats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: [] }),
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 60 },
      }
    );
    const json = await res.json();
    if (!json.okay) return null;
    return unwrapStats(hexToCV(json.result));
  } catch {
    return null;
  }
}

async function getPrices(): Promise<{ stxUsd: number; btcUsd: number }> {
  try {
    const r = await fetch(
      `${COINGECKO_API}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) }
    );
    const j = await r.json();
    return { stxUsd: j?.blockstack?.usd ?? 0, btcUsd: j?.bitcoin?.usd ?? 0 };
  } catch {
    return { stxUsd: 0, btcUsd: 0 };
  }
}

export async function GET() {
  const [stxVault, sbtcVault, prices] = await Promise.all([
    getStats(DCA_CONTRACT_ADDRESS, DCA_CONTRACT_NAME),
    getStats(DCA_SBTC_CONTRACT_ADDRESS, DCA_SBTC_CONTRACT_NAME),
    getPrices(),
  ]);

  const plansCreated   = (stxVault?.plans    ?? 0) + (sbtcVault?.plans    ?? 0);
  const swapsExecuted  = (stxVault?.executed ?? 0) + (sbtcVault?.executed ?? 0);
  const stxVolUsd  = stxVault  ? (stxVault.volume  / 1_000_000)   * prices.stxUsd : 0;
  const sbtcVolUsd = sbtcVault ? (sbtcVault.volume / 100_000_000) * prices.btcUsd : 0;
  const volumeUsd  = stxVolUsd + sbtcVolUsd;
  const avgSwapsPerPlan = plansCreated > 0 ? swapsExecuted / plansCreated : 0;

  return NextResponse.json(
    {
      plansCreated,
      volumeUsd,
      swapsExecuted,
      avgSwapsPerPlan,
      sources: {
        stxVault: stxVault ? "ok" : "unavailable",
        sbtcVault: sbtcVault ? "ok" : "unavailable",
        prices: prices.stxUsd > 0 && prices.btcUsd > 0 ? "ok" : "partial",
      },
      updatedAt: Date.now(),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
