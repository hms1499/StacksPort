// src/lib/domain/stacking/clarity.ts
// Pure Clarity value-object builder for the StackingDAO deposit. Mirrors
// domain/swap/clarity.ts: builds immutable params; no fetch, no broadcast.

import {
  contractPrincipalCV,
  uintCV,
  noneCV,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";

import { STACKING_DAO, RESERVE } from "./contracts";

export interface StakeParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

/**
 * Build the `stacking-dao-core-v1.deposit` params for staking
 * `stxAmountUstx` micro-STX from `senderAddress`. The post-condition pins
 * EXACTLY `stxAmountUstx` micro-STX leaving the wallet; Deny mode blocks any
 * other unexpected transfer. Minted stSTX (variable) is not post-conditioned.
 */
export function buildStakeParams(stxAmountUstx: number, senderAddress: string): StakeParams {
  return {
    contractAddress: STACKING_DAO.address,
    contractName: STACKING_DAO.name,
    functionName: "deposit",
    functionArgs: [
      contractPrincipalCV(RESERVE.address, RESERVE.name),
      uintCV(stxAmountUstx),
      noneCV(),
    ],
    postConditions: [Pc.principal(senderAddress).willSendEq(stxAmountUstx).ustx()],
    postConditionMode: PostConditionMode.Deny,
  };
}
