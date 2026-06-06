import { ClarityType, type ClarityValue } from "@stacks/transactions";

export interface VaultStats {
  plans: number;
  volume: number;
  executed: number;
}

export interface ProtocolPrices {
  stxUsd: number | null;
  btcUsd: number | null;
}

export interface ProtocolMetricSources {
  stxVault: "ok" | "unavailable";
  sbtcVault: "ok" | "unavailable";
  prices: "ok" | "partial" | "unavailable";
}

export interface ProtocolMetricsResponse {
  plansCreated: number | null;
  volumeUsd: number | null;
  swapsExecuted: number | null;
  avgSwapsPerPlan: number | null;
  sources: ProtocolMetricSources;
  updatedAt: number;
}

function clarityTypeMatches(
  value: { type?: unknown },
  numericType: ClarityType,
  stringType: string
): boolean {
  return value.type === numericType || value.type === stringType;
}

function readUint(
  tuple: Record<string, unknown>,
  key: string
): number {
  const field = tuple[key] as { type?: unknown; value?: unknown } | undefined;
  if (!field || !clarityTypeMatches(field, ClarityType.UInt, "uint")) {
    throw new Error(`expected uint field: ${key}`);
  }

  const parsed = Number(field.value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`invalid uint field: ${key}`);
  }
  return parsed;
}

export function parseVaultStats(cv: ClarityValue): VaultStats {
  const root = cv as unknown as { type?: unknown; value?: unknown };
  if (!clarityTypeMatches(root, ClarityType.ResponseOk, "ok")) {
    throw new Error("expected (ok ...)");
  }

  const tuple = root.value as { type?: unknown; value?: unknown } | undefined;
  if (!tuple || !clarityTypeMatches(tuple, ClarityType.Tuple, "tuple")) {
    throw new Error("expected stats tuple");
  }

  const fields = tuple.value as Record<string, unknown> | undefined;
  if (!fields || typeof fields !== "object") {
    throw new Error("expected tuple fields");
  }

  return {
    plans: readUint(fields, "total-plans"),
    volume: readUint(fields, "total-volume"),
    executed: readUint(fields, "total-executed"),
  };
}

export function buildProtocolMetrics({
  stxVault,
  sbtcVault,
  prices,
  updatedAt = Date.now(),
}: {
  stxVault: VaultStats | null;
  sbtcVault: VaultStats | null;
  prices: ProtocolPrices;
  updatedAt?: number;
}): ProtocolMetricsResponse {
  const vaultsAvailable = stxVault !== null && sbtcVault !== null;
  const pricesAvailable = prices.stxUsd !== null && prices.btcUsd !== null;

  const plansCreated = vaultsAvailable
    ? stxVault.plans + sbtcVault.plans
    : null;
  const swapsExecuted = vaultsAvailable
    ? stxVault.executed + sbtcVault.executed
    : null;
  const volumeUsd = vaultsAvailable && pricesAvailable
    ? (stxVault.volume / 1_000_000) * prices.stxUsd
      + (sbtcVault.volume / 100_000_000) * prices.btcUsd
    : null;
  const avgSwapsPerPlan =
    plansCreated !== null && swapsExecuted !== null
      ? plansCreated > 0
        ? swapsExecuted / plansCreated
        : 0
      : null;

  let priceStatus: ProtocolMetricSources["prices"] = "unavailable";
  if (pricesAvailable) {
    priceStatus = "ok";
  } else if (prices.stxUsd !== null || prices.btcUsd !== null) {
    priceStatus = "partial";
  }

  return {
    plansCreated,
    volumeUsd,
    swapsExecuted,
    avgSwapsPerPlan,
    sources: {
      stxVault: stxVault ? "ok" : "unavailable",
      sbtcVault: sbtcVault ? "ok" : "unavailable",
      prices: priceStatus,
    },
    updatedAt,
  };
}
