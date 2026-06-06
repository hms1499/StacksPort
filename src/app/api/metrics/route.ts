import { NextResponse } from "next/server";
import { hexToCV } from "@stacks/transactions";
import { DCA_CONTRACT_ADDRESS, DCA_CONTRACT_NAME } from "@/lib/dca";
import { DCA_SBTC_CONTRACT_ADDRESS, DCA_SBTC_CONTRACT_NAME } from "@/lib/dca-sbtc";
import {
  buildProtocolMetrics,
  parseVaultStats,
  type ProtocolPrices,
  type VaultStats,
} from "@/lib/server/protocol-metrics";

export const revalidate = 60;

const HIRO_API = "https://api.hiro.so";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
// Stacks burn/genesis address — accepted by Hiro for unauthenticated read-only calls
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

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
    return parseVaultStats(hexToCV(json.result));
  } catch {
    return null;
  }
}

function validPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

async function getPrices(): Promise<ProtocolPrices> {
  try {
    const r = await fetch(
      `${COINGECKO_API}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) }
    );
    const j = await r.json();
    return {
      stxUsd: validPrice(j?.blockstack?.usd),
      btcUsd: validPrice(j?.bitcoin?.usd),
    };
  } catch {
    return { stxUsd: null, btcUsd: null };
  }
}

export async function GET() {
  const [stxVault, sbtcVault, prices] = await Promise.all([
    getStats(DCA_CONTRACT_ADDRESS, DCA_CONTRACT_NAME),
    getStats(DCA_SBTC_CONTRACT_ADDRESS, DCA_SBTC_CONTRACT_NAME),
    getPrices(),
  ]);

  const metrics = buildProtocolMetrics({ stxVault, sbtcVault, prices });

  return NextResponse.json(
    metrics,
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
