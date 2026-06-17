import { openContractCall } from "@stacks/connect";
import { uintCV, contractPrincipalCV } from "@stacks/transactions";

export const MIN_DEPOSIT_USTX = 2_000_000; // 2 STX
export const MAX_OPEN_ORDERS = 10;
const USD_SCALE = 1_000_000;

export const LIMIT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const LIMIT_CONTRACT_NAME = "limit-order-vault";
// sBTC target token (SIP-010). Source = STX.
export const SBTC_TOKEN =
  "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
export const LIMIT_SWAP_ROUTER =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router";

export interface LimitOrder {
  id: number;
  owner: string;
  token: string;
  amtMicroStx: number;
  targetUsdMicro: number;
  status: 0 | 1 | 2; // open | filled | cancelled
  createdAtBlock: number;
  filledAtBlock: number;
}

export const usdToMicro = (n: number) => Math.round(n * USD_SCALE);
export const microToUsd = (n: number) => n / USD_SCALE;

export function validateLimitOrder(input: {
  depositStx: number;
  targetUsd: number;
  openOrderCount: number;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!(input.depositStx >= MIN_DEPOSIT_USTX / 1_000_000)) {
    errors.push("Deposit must be at least 2 STX");
  }
  if (!(input.targetUsd > 0)) {
    errors.push("Target price must be greater than 0");
  }
  if (input.openOrderCount >= MAX_OPEN_ORDERS) {
    errors.push("You have reached the maximum of 10 open orders");
  }
  return { ok: errors.length === 0, errors };
}

export function createLimitOrder(
  targetToken: string,
  depositMicroStx: number,
  targetUsdMicro: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [tAddr, tName] = targetToken.split(".");
  openContractCall({
    contractAddress: LIMIT_CONTRACT_ADDRESS,
    contractName: LIMIT_CONTRACT_NAME,
    functionName: "create-order",
    functionArgs: [
      contractPrincipalCV(tAddr, tName),
      uintCV(depositMicroStx),
      uintCV(targetUsdMicro),
    ],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function cancelLimitOrder(
  orderId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: LIMIT_CONTRACT_ADDRESS,
    contractName: LIMIT_CONTRACT_NAME,
    functionName: "cancel-order",
    functionArgs: [uintCV(orderId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}
