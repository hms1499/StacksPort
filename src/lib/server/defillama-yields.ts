const DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools";

interface LlamaPool {
  chain?: unknown;
  project?: unknown;
  symbol?: unknown;
  apy?: unknown;
}

/** Filter the DefiLlama pools payload to Stacks/zest-v2 and map SYMBOL -> apy%. */
export function parseZestApy(raw: unknown): Record<string, number> {
  const list: unknown = Array.isArray(raw)
    ? raw
    : (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) return {};

  const out: Record<string, number> = {};
  for (const p of list as LlamaPool[]) {
    if (p?.chain !== "Stacks" || p?.project !== "zest-v2") continue;
    if (typeof p.symbol !== "string") continue;
    if (p.apy == null) continue;
    const apy = Number(p.apy);
    if (!Number.isFinite(apy)) continue;
    out[p.symbol.toUpperCase()] = apy;
  }
  return out;
}

/** Network fetch + parse. Returns null on any failure (fail-invisible). */
export async function fetchZestApy(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(DEFILLAMA_POOLS_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseZestApy(await res.json());
  } catch {
    return null;
  }
}
