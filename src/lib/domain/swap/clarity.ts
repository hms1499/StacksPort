// src/lib/domain/swap/clarity.ts
// Clarity value-object builders for swap transactions. Pure — every helper
// builds an immutable value; no `fetch`, no signing, no broadcast.

import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  ClarityType,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";

import { SBTC, USDCX } from "./contracts";
import { ROUTE_TABLE } from "./routes";
import { SWAP_TOKENS } from "./tokens";
import { toRawAmount } from "./amount";

export interface SwapParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

export function cvToHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

export function unwrapOkUint(cv: ClarityValue): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as any;

  // String-based type (newer @stacks/transactions)
  if (raw.type === "ok") return Number(raw.value?.value ?? raw.value ?? 0);

  // Enum-based type (legacy)
  if (raw.type === ClarityType.ResponseOk) return Number(raw.value?.value ?? 0);

  throw new Error("Unexpected Clarity value type");
}

// hexToCV is re-exported for the infra read-only adapter (Task 5). It is a
// pure decoder, so keeping it routed through the domain layer is fine.
export { hexToCV };

const SBTC_ASSET = `${SBTC.address}.${SBTC.name}` as const;
const USDCX_ASSET = `${USDCX.address}.${USDCX.name}` as const;
const USDCX_TOKEN_NAME = "usdcx-token";

/**
 * Post-condition guaranteeing the sender parts with EXACTLY `amountInRaw` of
 * the input token and nothing else of theirs leaves the wallet. Combined
 * with Deny mode this closes the catastrophic "contract drains more than
 * expected" vector. The minimum received amount is enforced on-chain by the
 * swap's `min-amount-out` argument, which reverts the tx if the output is
 * too low.
 */
function senderSpendPostCondition(
  fromId: string,
  amountInRaw: bigint,
  senderAddress: string
): PostCondition {
  if (fromId === "stx") {
    return Pc.principal(senderAddress).willSendEq(amountInRaw).ustx();
  }
  if (fromId === "sbtc") {
    return Pc.principal(senderAddress)
      .willSendEq(amountInRaw)
      .ft(SBTC_ASSET, SBTC.name);
  }
  if (fromId === "usdcx") {
    return Pc.principal(senderAddress)
      .willSendEq(amountInRaw)
      .ft(USDCX_ASSET, USDCX_TOKEN_NAME);
  }
  throw new Error(`No post-condition rule for input token ${fromId}`);
}

export function buildSwapParams(
  fromId: string,
  toId: string,
  amountInHuman: string | number,
  minAmountOutRaw: bigint | number,
  senderAddress: string
): SwapParams {
  const spec = ROUTE_TABLE.find((r) => r.from === fromId && r.to === toId);
  if (!spec) throw new Error(`No swap builder for ${fromId} → ${toId}`);

  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const amountInRaw = toRawAmount(amountInHuman, fromToken.decimals);
  const postConditions = [
    senderSpendPostCondition(fromId, amountInRaw, senderAddress),
  ];

  const e = spec.exec;
  const functionArgs: ClarityValue[] =
    e.kind === "router"
      ? [
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
          standardPrincipalCV(senderAddress),
        ]
      : [
          contractPrincipalCV(e.pool.address, e.pool.name),
          contractPrincipalCV(e.xToken.address, e.xToken.name),
          contractPrincipalCV(e.yToken.address, e.yToken.name),
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
        ];

  return {
    contractAddress: e.contract.address,
    contractName: e.contract.name,
    functionName: e.fn,
    functionArgs,
    postConditions,
    postConditionMode: PostConditionMode.Deny,
  };
}
