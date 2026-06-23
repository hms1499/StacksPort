import { describe, expect, it } from "vitest";
import {
  ZEST_BORROW_HELPER, ZEST_POOL_RESERVE, ZEST_ORACLE_SBTC,
  SBTC_ASSET, ZSBTC_ATOKEN, SBTC_FT_ASSET_NAME, SBTC_DECIMALS,
} from "./contracts";

describe("zest contracts", () => {
  it("pins verified mainnet principals", () => {
    expect(`${ZEST_BORROW_HELPER.address}.${ZEST_BORROW_HELPER.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-0");
    expect(`${ZEST_POOL_RESERVE.address}.${ZEST_POOL_RESERVE.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve");
    expect(`${ZEST_ORACLE_SBTC.address}.${ZEST_ORACLE_SBTC.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4");
    expect(`${SBTC_ASSET.address}.${SBTC_ASSET.name}`)
      .toBe("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    expect(`${ZSBTC_ATOKEN.address}.${ZSBTC_ATOKEN.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0");
    expect(SBTC_FT_ASSET_NAME).toBe("sbtc-token");
    expect(SBTC_DECIMALS).toBe(8);
  });
});
