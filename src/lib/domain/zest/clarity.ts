// Pure Clarity value-object builders for Zest sBTC supply/withdraw.
// Mirrors domain/stacking/clarity.ts. No fetch, no broadcast.
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  noneCV,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";
import {
  ZEST_BORROW_HELPER,
  ZEST_POOL_RESERVE,
  SBTC_ASSET,
  ZSBTC_ATOKEN,
  SBTC_FT_ASSET_NAME,
} from "./contracts";

export interface ZestParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

const sbtcAssetId = `${SBTC_ASSET.address}.${SBTC_ASSET.name}` as const;

/** borrow-helper-v2-0.supply: pin EXACTLY amountSats sbtc-token leaving owner. */
export function buildSupplyParams(amountSats: number, owner: string): ZestParams {
  return {
    contractAddress: ZEST_BORROW_HELPER.address,
    contractName: ZEST_BORROW_HELPER.name,
    functionName: "supply",
    functionArgs: [
      contractPrincipalCV(ZSBTC_ATOKEN.address, ZSBTC_ATOKEN.name),
      contractPrincipalCV(ZEST_POOL_RESERVE.address, ZEST_POOL_RESERVE.name),
      contractPrincipalCV(SBTC_ASSET.address, SBTC_ASSET.name),
      uintCV(amountSats),
      standardPrincipalCV(owner),
      noneCV(),
    ],
    postConditions: [
      Pc.principal(owner).willSendEq(amountSats).ft(sbtcAssetId, SBTC_FT_ASSET_NAME),
    ],
    postConditionMode: PostConditionMode.Deny,
  };
}
