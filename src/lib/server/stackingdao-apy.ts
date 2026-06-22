const STACKINGDAO_APY_URL = "https://app.stackingdao.com/api/apy";

/** Parse StackingDAO's numeric APY body. Null if unusable or out of (0, 100]. */
export function parseStackingApy(body: string): number | null {
  const n = Number(String(body).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

/** Network fetch + parse. Returns null on any failure (fail-invisible). */
export async function fetchStackingApy(): Promise<number | null> {
  try {
    const res = await fetch(STACKINGDAO_APY_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseStackingApy(await res.text());
  } catch {
    return null;
  }
}
