// src/lib/stacking-dao.ts
// StackingDAO liquid-stacking side effects: the wallet deposit call and a
// best-effort exchange-rate read. Pure param/amount logic lives in
// domain/stacking/*.

import { openContractCall } from "@stacks/connect";
import {
  serializeCV,
  hexToCV,
  uintCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";
import { buildStakeParams } from "./domain/stacking/clarity";
import { STACKING_DAO } from "./domain/stacking/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

/** Submit a StackingDAO deposit (stake STX → mint stSTX). Mirrors dca.ts. */
export function stakeStx(
  stxAmountUstx: number,
  senderAddress: string,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildStakeParams(stxAmountUstx, senderAddress);
  openContractCall({
    contractAddress: p.contractAddress,
    contractName: p.contractName,
    functionName: p.functionName,
    functionArgs: p.functionArgs,
    postConditions: p.postConditions,
    postConditionMode: p.postConditionMode,
    network: "mainnet",
    onFinish,
    onCancel,
  });
}

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

/**
 * Best-effort micro-STX value of 1 stSTX, used only to show an estimate
 * before signing. Returns null on any failure so the UI hides the estimate
 * without blocking staking. (Semantics verified in Step 1.)
 */
export async function fetchStxPerStStx(): Promise<number | null> {
  try {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${STACKING_DAO.address}/${STACKING_DAO.name}/get-stx-per-ststx-helper`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: [cvHex(uintCV(1_000_000))] }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    const json = await res.json();
    if (!json.okay) return null;
    const cv = hexToCV(json.result) as { type: ClarityType; value?: unknown };
    if (cv.type === ClarityType.UInt) return Number((cv as { value: bigint }).value);
    return null;
  } catch {
    return null;
  }
}
