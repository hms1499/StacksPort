// src/lib/dca-quote.ts
// Shared sBTC pool-quote helper against Bitflow xyk-core get-dx.
// Used by PlanCard (execute) and LivePreviewCard (estimate before creation).

const POOL_CONTRACT = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1";
const SBTC_TOKEN    = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const STX_TOKEN     = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2";
const GET_DX_URL    =
  "https://api.hiro.so/v2/contracts/call-read/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/xyk-core-v-1-2/get-dx";

function splitCid(cid: string): [string, string] {
  const [addr, name] = cid.split(".");
  return [addr, name];
}

/**
 * Quote sBTC output for a given net uSTX input (micro-STX after 0.3% vault fee).
 * Returns sBTC amount in normal units (1 sBTC = 1e8 sats).
 * Throws on no-liquidity or network failure.
 */
export async function quoteSbtcForUstx(netUstx: number): Promise<number> {
  const { contractPrincipalCV, uintCV, serializeCV, hexToCV } = await import("@stacks/transactions");

  const toHex = (cv: unknown) => {
    const bytes = serializeCV(cv as Parameters<typeof serializeCV>[0]);
    const hex = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("hex");
    return "0x" + hex;
  };

  const [poolAddr, poolName] = splitCid(POOL_CONTRACT);
  const [sbtcAddr, sbtcName] = splitCid(SBTC_TOKEN);
  const [stxAddr,  stxName]  = splitCid(STX_TOKEN);

  const args = [
    toHex(contractPrincipalCV(poolAddr, poolName)),
    toHex(contractPrincipalCV(sbtcAddr, sbtcName)),
    toHex(contractPrincipalCV(stxAddr, stxName)),
    toHex(uintCV(netUstx)),
  ];

  const res = await fetch(GET_DX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: "SP000000000000000000002Q6VF78", arguments: args }),
  });
  const data = await res.json();
  if (!data.okay) throw new Error(data.cause ?? "get-dx failed");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cv = hexToCV(data.result) as any;
  const sats = Number(cv?.value?.value ?? cv?.value ?? 0);
  if (!sats || sats <= 0) throw new Error("No liquidity in pool");
  return sats / 1e8;
}

/**
 * Apply the 0.3% vault protocol fee to a gross uSTX amount.
 * Returns the net uSTX that will actually reach the router.
 */
export function netUstxAfterFee(grossUstx: number): number {
  return grossUstx - Math.floor(grossUstx * 30 / 10000);
}
