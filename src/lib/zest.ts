// src/lib/zest.ts
// Zest sBTC side effects: wallet supply/withdraw + best-effort read-only
// position reads. Pure params live in domain/zest/*.
import { openContractCall } from "@stacks/connect";
import {
  serializeCV,
  hexToCV,
  cvToJSON,
  standardPrincipalCV,
  type ClarityValue,
} from "@stacks/transactions";
import {
  buildSupplyParams,
  buildWithdrawParams,
  type CollateralReserve,
} from "./domain/zest/clarity";
import {
  ZSBTC_ATOKEN,
  SBTC_ASSET,
  ZEST_ORACLE_SBTC,
} from "./domain/zest/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

async function callRead(
  address: string,
  name: string,
  fn: string,
  args: string[]
): Promise<unknown> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${address}/${name}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
      signal: AbortSignal.timeout(8_000),
    }
  );
  const json = await res.json();
  if (!json.okay) return null;
  return cvToJSON(hexToCV(json.result));
}

/** Submit a Zest sBTC supply. */
export function supplyZestSbtc(
  amountSats: number,
  owner: string,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildSupplyParams(amountSats, owner);
  openContractCall({ ...p, network: "mainnet", onFinish, onCancel });
}

/** Submit a Zest sBTC withdraw. */
export function withdrawZestSbtc(
  amountSats: number,
  owner: string,
  collateralAssets: CollateralReserve[],
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildWithdrawParams(amountSats, owner, collateralAssets);
  openContractCall({ ...p, network: "mainnet", onFinish, onCancel });
}

/**
 * a-token (zsbtc) balance in sats; 0 on any failure (fail-invisible).
 * get-principal-balance returns (ok uint) →
 *   cvToJSON shape: { value: { value: "123" } }
 */
export async function readZsbtcBalance(owner: string): Promise<number> {
  try {
    const parsed = (await callRead(
      ZSBTC_ATOKEN.address,
      ZSBTC_ATOKEN.name,
      "get-principal-balance",
      [cvHex(standardPrincipalCV(owner))]
    )) as { value?: { value?: string } } | null;
    const n = Number(parsed?.value?.value);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export const SBTC_RESERVE: CollateralReserve = {
  asset: SBTC_ASSET,
  lpToken: ZSBTC_ATOKEN,
  oracle: ZEST_ORACLE_SBTC,
};

/**
 * The user's reserves used as collateral, for the withdraw health-factor calc.
 * This phase supports the sBTC reserve only — it is complete and correct for an
 * sBTC-only supplier (the supported case). A user holding ADDITIONAL Zest
 * collateral (e.g. stSTX) would need those reserves added here; that is a
 * documented follow-up, not in scope for this phase.
 */
export async function readUserCollateralReserves(
  _owner: string
): Promise<CollateralReserve[]> {
  return [SBTC_RESERVE];
}
