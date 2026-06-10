import { describe, it, expect } from "vitest";
import { StacksClient } from "./stacks-client.js";
import type { BotConfig } from "./config.js";

const cfg = {
  stxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault",
  sbtcVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2",
  stxUsdcxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx",
  hiroApiUrl: "https://api.hiro.so",
} as unknown as BotConfig;

describe("StacksClient vault routing", () => {
  it("exposes a distinct DCAVault for the STX→USDCx contract", () => {
    const c = new StacksClient(cfg);
    const v = (c as unknown as { getVault(id: string): { contractName: string } })
      .getVault(cfg.stxUsdcxVaultContract);
    expect(v.contractName).toBe("dca-vault-stx-usdcx");
  });
});
