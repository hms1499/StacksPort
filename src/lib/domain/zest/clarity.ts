// Pure Clarity value-object builders for Zest sBTC supply/withdraw.
// Mirrors domain/stacking/clarity.ts. No fetch, no broadcast.
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  noneCV,
  Pc,
  PostConditionMode,
  listCV,
  tupleCV,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";
import {
  ZEST_BORROW_HELPER,
  ZEST_POOL_RESERVE,
  SBTC_ASSET,
  ZSBTC_ATOKEN,
  SBTC_FT_ASSET_NAME,
  ZEST_ORACLE_SBTC,
  type ContractId,
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

export interface CollateralReserve {
  asset: ContractId;
  lpToken: ContractId;
  oracle: ContractId;
}

const cp = (c: ContractId) => contractPrincipalCV(c.address, c.name);

/**
 * borrow-helper-v2-0.withdraw. `collateralAssets` is the user's full set of
 * reserves used as collateral (for the health-factor calc); built in Task 7.
 * Allow mode: the returned sBTC is sent by an internal Zest principal and
 * varies with accrued interest, so an owner-send Deny PC does not apply.
 */
export function buildWithdrawParams(
  amountSats: number,
  owner: string,
  collateralAssets: CollateralReserve[]
): ZestParams {
  const assetsList = listCV(
    collateralAssets.map((r) =>
      tupleCV({ asset: cp(r.asset), "lp-token": cp(r.lpToken), oracle: cp(r.oracle) })
    )
  );
  return {
    contractAddress: ZEST_BORROW_HELPER.address,
    contractName: ZEST_BORROW_HELPER.name,
    functionName: "withdraw",
    functionArgs: [
      contractPrincipalCV(ZSBTC_ATOKEN.address, ZSBTC_ATOKEN.name),
      contractPrincipalCV(ZEST_POOL_RESERVE.address, ZEST_POOL_RESERVE.name),
      contractPrincipalCV(SBTC_ASSET.address, SBTC_ASSET.name),
      contractPrincipalCV(ZEST_ORACLE_SBTC.address, ZEST_ORACLE_SBTC.name),
      uintCV(amountSats),
      standardPrincipalCV(owner),
      assetsList,
    ],
    postConditions: [],
    postConditionMode: PostConditionMode.Allow,
  };
}
