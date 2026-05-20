import {
  serializeCV,
  hexToCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositionLine {
  label: string;
  tokenAmount: string;
  usdValue: number;
}

export interface ProtocolPosition {
  lines: PositionLine[];
  totalUsd: number;
}

// Protocols that support position fetching. DEX protocols are excluded.
export const SUPPORTED_PROTOCOLS = new Set([
  "StackingDAO",
  "Lisa",
  "Arkadiko",
  "Zest Protocol",
]);

// ─── Clarity helpers ──────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";
// Stacks genesis/burn address — valid on mainnet, accepted by Hiro for read-only calls
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return Number(raw.value);
    case ClarityType.BoolTrue: return true;
    case ClarityType.BoolFalse: return false;
    case ClarityType.OptionalNone: return null;
    case ClarityType.OptionalSome: return parseCV(raw.value);
    case ClarityType.ResponseOk: return parseCV(raw.value);
    case ClarityType.ResponseErr: throw new Error(`Contract error: ${JSON.stringify(raw.value)}`);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw.value ?? {})) result[k] = parseCV(v as ClarityValue);
      return result;
    }
    case ClarityType.List:
      return (raw.value ?? [] as ClarityValue[]).map((item: ClarityValue) => parseCV(item));
    default: return null;
  }
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
