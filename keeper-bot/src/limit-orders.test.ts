// Plain-Node assert test (keeper convention — no vitest). Run via:
//   node --loader ts-node/esm src/limit-orders.test.ts
// Mocks global.fetch so getExecutableLimitOrders sees oc=2 with one OPEN and
// one FILLED order, and asserts it returns only the open one.
import { Cl, serializeCV, type ClarityValue } from "@stacks/transactions";
import { StacksClient } from "./stacks-client.js";
import type { BotConfig } from "./config.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function hexResult(cv: ClarityValue): string {
  const s = serializeCV(cv);
  return typeof s === "string" ? "0x" + s : "0x" + Buffer.from(s as Uint8Array).toString("hex");
}

const OWNER = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";

function orderTuple(status: number) {
  return Cl.some(
    Cl.tuple({
      owner: Cl.standardPrincipal(OWNER),
      token: Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token"),
      amt: Cl.uint(5_000_000),
      "target-usd": Cl.uint(60_000_000_000),
      status: Cl.uint(status),
      cat: Cl.uint(1000),
      fab: Cl.uint(0),
    })
  );
}

// get-stats -> { oc: 2, tvol: 0, toe: 0 }
const statsHex = hexResult(Cl.tuple({ oc: Cl.uint(2), tvol: Cl.uint(0), toe: Cl.uint(0) }));
const order1Hex = hexResult(orderTuple(0)); // open
const order2Hex = hexResult(orderTuple(1)); // filled

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = async (url: string, opts: { body: string }) => {
  let result = statsHex;
  if (url.includes("/get-order")) {
    const body = JSON.parse(opts.body) as { arguments: string[] };
    // arg is a serialized uint; id=1 -> open, id=2 -> filled.
    const idArg = body.arguments[0];
    result = idArg === hexResult(Cl.uint(1)) ? order1Hex : order2Hex;
  }
  return { json: async () => ({ okay: true, result }) };
};

const cfg = {
  stxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault",
  sbtcVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2",
  stxUsdcxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx",
  limitOrderVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.limit-order-vault",
  hiroApiUrl: "https://api.hiro.so",
} as unknown as BotConfig;

async function main(): Promise<void> {
  const client = new StacksClient(cfg);
  const out = await client.getExecutableLimitOrders();
  assert(
    JSON.stringify(out.map((o) => o.orderId)) === JSON.stringify([1]),
    "returns only OPEN limit orders up to the counter"
  );
  assert(out[0].amt === 5_000_000, "decodes the order amount");
  assert(out[0].targetUsdMicro === 60_000_000_000, "decodes the target-usd");
  console.log("all passed");
}

main().catch((e) => {
  console.error("THROWN:", e instanceof Error ? e.stack : JSON.stringify(e));
  process.exit(1);
});
