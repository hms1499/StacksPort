import { getSTXBalance, getFungibleTokens } from "@/lib/stacks";
import {
  getSwappableFromTokens,
  getValidDestinations,
  type SwapToken,
} from "@/lib/direct-swap";

export type Status =
  | "idle"
  | "quoting"
  | "ready"
  | "swapping"
  | "success"
  | "error";

export const fromTokens = getSwappableFromTokens();
export const STX_TOKEN = fromTokens.find((t) => t.id === "stx")!;

export function resolveInitialPair(
  fromParam: string | null,
  toParam: string | null
): { from: SwapToken; to: SwapToken | null } {
  const fromMatch = fromParam
    ? fromTokens.find((t) => t.id === fromParam.toLowerCase())
    : undefined;

  // If only `to` provided, pick a sensible source: STX for sBTC, sBTC otherwise.
  if (!fromMatch && toParam) {
    const toId = toParam.toLowerCase();
    const sourcesForTo = fromTokens.filter((t) =>
      getValidDestinations(t.id).some((d) => d.id === toId)
    );
    const preferred =
      sourcesForTo.find((t) => t.id === "stx") ?? sourcesForTo[0];
    if (preferred) {
      const dest = getValidDestinations(preferred.id).find((d) => d.id === toId);
      if (dest) return { from: preferred, to: dest };
    }
  }

  const from = fromMatch ?? fromTokens[0];
  const dests = getValidDestinations(from.id);
  const toMatch = toParam
    ? dests.find((d) => d.id === toParam.toLowerCase())
    : null;
  return { from, to: toMatch ?? null };
}

// Reuses the shared Hiro helpers (timeout + 30s revalidate) instead of a
// second, less robust fetch path. Errors fall back to 0 (handled by caller).
export async function fetchTokenBalance(
  address: string,
  token: SwapToken
): Promise<number> {
  try {
    if (!token.contract) {
      const data = await getSTXBalance(address);
      return Number(data.balance ?? 0) / Math.pow(10, token.decimals);
    }
    const data = await getFungibleTokens(address);
    const fts = (data.fungible_tokens ?? {}) as Record<
      string,
      { balance: string }
    >;
    const contractId = token.contract.toLowerCase();
    const match = Object.entries(fts).find(([key]) =>
      key.toLowerCase().startsWith(contractId)
    );
    if (!match) return 0;
    return Number(match[1].balance) / Math.pow(10, token.decimals);
  } catch {
    return 0;
  }
}
