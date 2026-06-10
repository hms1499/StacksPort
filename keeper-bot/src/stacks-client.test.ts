// Quick smoke test: run with `node --loader ts-node/esm src/stacks-client.test.ts`
// Verifies vault routing: each vault contract id resolves to a DCAVault whose
// contractName matches — in particular the new STX→USDCx vault (vault-type 2).
import { StacksClient } from "./stacks-client.js";
import type { BotConfig } from "./config.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const cfg = {
  stxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault",
  sbtcVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2",
  stxUsdcxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx",
  hiroApiUrl: "https://api.hiro.so",
} as unknown as BotConfig;

function main(): void {
  const client = new StacksClient(cfg);
  const getVault = (
    client as unknown as { getVault(id: string): { contractName: string } }
  ).getVault.bind(client);

  assert(
    getVault(cfg.stxUsdcxVaultContract).contractName === "dca-vault-stx-usdcx",
    "STX→USDCx contract id routes to a vault with contractName dca-vault-stx-usdcx"
  );
  assert(
    getVault(cfg.sbtcVaultContract).contractName === "dca-vault-sbtc-v2",
    "sBTC contract id routes to the sBTC vault"
  );
  assert(
    getVault(cfg.stxVaultContract).contractName === "dca-vault",
    "STX→sBTC contract id routes to the STX vault"
  );

  console.log("all passed");
}

main();
