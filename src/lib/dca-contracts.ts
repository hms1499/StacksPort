export const DCA_CONTRACT_ADDRESS =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const DCA_CONTRACT_NAME = "dca-vault-v2";

export const DCA_SBTC_CONTRACT_ADDRESS =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const DCA_SBTC_CONTRACT_NAME = "dca-vault-sbtc-v2";

export const DCA_CONTRACT_ID = `${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}`;
export const DCA_SBTC_CONTRACT_ID =
  `${DCA_SBTC_CONTRACT_ADDRESS}.${DCA_SBTC_CONTRACT_NAME}`;

export const STACKS_EXPLORER_BASE = "https://explorer.hiro.so";

export function mainnetContractExplorerUrl(contractId: string): string {
  return `${STACKS_EXPLORER_BASE}/txid/${contractId}?chain=mainnet`;
}
