import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";
import { parseOrderTuple } from "./limit-orders-read";

function someOrder(status: number) {
  return Cl.some(
    Cl.tuple({
      owner: Cl.standardPrincipal("SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV"),
      token: Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token"),
      amt: Cl.uint(5_000_000),
      "target-usd": Cl.uint(60_000_000_000),
      status: Cl.uint(status),
      cat: Cl.uint(1000),
      fab: Cl.uint(0),
    })
  );
}

describe("parseOrderTuple", () => {
  it("decodes an open order tuple", () => {
    const o = parseOrderTuple(someOrder(0), 3);
    expect(o).not.toBeNull();
    expect(o!.id).toBe(3);
    expect(o!.amtMicroStx).toBe(5_000_000);
    expect(o!.targetUsdMicro).toBe(60_000_000_000);
    expect(o!.status).toBe(0);
  });

  it("returns null for a none (missing) order", () => {
    expect(parseOrderTuple(Cl.none(), 9)).toBeNull();
  });
});
