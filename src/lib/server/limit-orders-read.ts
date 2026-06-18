import {
  serializeCV,
  hexToCV,
  ClarityType,
  standardPrincipalCV,
  uintCV,
  cvToValue,
  type ClarityValue,
} from "@stacks/transactions";
import {
  LIMIT_CONTRACT_ADDRESS,
  LIMIT_CONTRACT_NAME,
  type LimitOrder,
} from "@/lib/limit-orders";

// ─── Clarity read-only helpers (mirror src/lib/protocol-positions.ts) ──────────

const HIRO_API = "https://api.hiro.so";
// Stacks genesis/burn address — valid on mainnet, accepted by Hiro for read-only calls.
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

async function callReadOnly(
  contractAddress: string,
  contractName: string,
  fn: string,
  args: string[] = []
): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
      signal: AbortSignal.timeout(8_000),
    }
  );
  const json = await res.json();
  if (!json.okay) throw new Error(json.cause ?? "read-only call failed");
  return hexToCV(json.result);
}

// ─── Tuple parsing ─────────────────────────────────────────────────────────────

export function parseOrderTuple(cv: ClarityValue, id: number): LimitOrder | null {
  if (cv.type !== ClarityType.OptionalSome) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = cvToValue(cv) as any; // some(tuple) -> { value: { owner, token, amt, 'target-usd', status, cat, fab } }
  const t = v.value ?? v;
  return {
    id,
    owner: String(t.owner.value ?? t.owner),
    token: String(t.token.value ?? t.token),
    amtMicroStx: Number(t.amt.value ?? t.amt),
    targetUsdMicro: Number(t["target-usd"].value ?? t["target-usd"]),
    status: Number(t.status.value ?? t.status) as 0 | 1 | 2,
    createdAtBlock: Number(t.cat.value ?? t.cat),
    filledAtBlock: Number(t.fab.value ?? t.fab),
  };
}

// ─── Public fetch ──────────────────────────────────────────────────────────────

export async function getUserLimitOrders(address: string): Promise<LimitOrder[]> {
  // 1) read the user's order ids
  const idsCv = await callReadOnly(
    LIMIT_CONTRACT_ADDRESS,
    LIMIT_CONTRACT_NAME,
    "get-user-orders",
    [cvHex(standardPrincipalCV(address))]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids: number[] = (cvToValue(idsCv) as any[]).map((x) => Number(x.value ?? x));
  // 2) fetch each order, keep OPEN (status 0)
  const orders = await Promise.all(
    ids.map(async (id) => {
      const cv = await callReadOnly(
        LIMIT_CONTRACT_ADDRESS,
        LIMIT_CONTRACT_NAME,
        "get-order",
        [cvHex(uintCV(id))]
      );
      return parseOrderTuple(cv, id);
    })
  );
  return orders.filter((o): o is LimitOrder => o !== null && o.status === 0);
}
