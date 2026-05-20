import {
  serializeCV,
  hexToCV,
  ClarityType,
  standardPrincipalCV,
  uintCV,
  type ClarityValue,
} from "@stacks/transactions";
import { getSTXPrice, getFungibleTokens, type KnownProtocol } from "@/lib/stacks";

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

// ─── StackingDAO ─────────────────────────────────────────────────────────────
// get-stx-balance(address) → uint128 micro-STX currently staked by this user

const STACKING_DAO_ADDR = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG";
const STACKING_DAO_NAME = "stacking-dao-core-v1";

async function fetchStackingDaoPosition(
  address: string,
  stxPrice: number
): Promise<ProtocolPosition | null> {
  const cv = await callReadOnly(STACKING_DAO_ADDR, STACKING_DAO_NAME, "get-stx-balance", [
    cvHex(standardPrincipalCV(address)),
  ]);
  const microStx = parseCV(cv) as number;
  if (microStx === 0) return null;

  const stxAmount = microStx / 1_000_000;
  const usdValue = stxAmount * stxPrice;
  return {
    lines: [{ label: "Staked", tokenAmount: `${stxAmount.toFixed(2)} STX`, usdValue }],
    totalUsd: usdValue,
  };
}

// ─── Lisa ─────────────────────────────────────────────────────────────────────
// User holds lqstx shares in wallet. Asset id: "<contract>::lqstx"
// get-shares-to-tokens(shares) → uint128 micro-STX equivalent

async function fetchLisaPosition(
  address: string,
  stxPrice: number,
  fungibleTokens: Record<string, { balance: string }>
): Promise<ProtocolPosition | null> {
  // Find any lqstx asset regardless of exact deployer (handles protocol upgrades)
  const entry = Object.entries(fungibleTokens).find(([id]) =>
    id.endsWith("::lqstx")
  );
  if (!entry) return null;

  const [assetId, { balance }] = entry;
  const shares = Number(balance);
  if (shares === 0) return null;

  // Extract contract address and name from "SP...contract-name::lqstx"
  const contractId = assetId.split("::")[0];
  const dotIndex = contractId.lastIndexOf(".");
  const contractAddr = contractId.slice(0, dotIndex);
  const contractName = contractId.slice(dotIndex + 1);

  const cv = await callReadOnly(contractAddr, contractName, "get-shares-to-tokens", [
    cvHex(uintCV(shares)),
  ]);
  const microStx = parseCV(cv) as number;
  if (microStx === 0) return null;

  const stxAmount = microStx / 1_000_000;
  const usdValue = stxAmount * stxPrice;
  return {
    lines: [{ label: "Staked", tokenAmount: `${stxAmount.toFixed(2)} STX`, usdValue }],
    totalUsd: usdValue,
  };
}

// ─── Arkadiko ─────────────────────────────────────────────────────────────────
// get-vault-entries(user)  → { ids: uint128[] }  (zeros = empty slots)
// get-vault-by-id(id)      → { collateral, debt, "is-liquidated", ... }
// collateral: micro-STX   debt: micro-USDA (pegged $1)

const ARKADIKO_ADDR = "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR";
const ARKADIKO_NAME = "arkadiko-freddie-v1-1";

async function fetchArkadikoPosition(
  address: string,
  stxPrice: number
): Promise<ProtocolPosition | null> {
  const entriesCv = await callReadOnly(ARKADIKO_ADDR, ARKADIKO_NAME, "get-vault-entries", [
    cvHex(standardPrincipalCV(address)),
  ]);
  const { ids } = parseCV(entriesCv) as { ids: number[] };
  const vaultIds = ids.filter((id) => id > 0);
  if (vaultIds.length === 0) return null;

  let totalCollateralStx = 0;
  let totalDebtUsda = 0;

  await Promise.all(
    vaultIds.map(async (id) => {
      const vaultCv = await callReadOnly(ARKADIKO_ADDR, ARKADIKO_NAME, "get-vault-by-id", [
        cvHex(uintCV(id)),
      ]);
      const vault = parseCV(vaultCv) as {
        collateral: number;
        debt: number;
        "is-liquidated": boolean;
      };
      if (vault["is-liquidated"]) return;
      totalCollateralStx += vault.collateral / 1_000_000;
      totalDebtUsda += vault.debt / 1_000_000;
    })
  );

  if (totalCollateralStx === 0) return null;

  const collateralUsd = totalCollateralStx * stxPrice;
  const debtUsd = totalDebtUsda; // USDA is pegged $1
  return {
    lines: [
      { label: "Collateral", tokenAmount: `${totalCollateralStx.toFixed(2)} STX`, usdValue: collateralUsd },
      { label: "Debt", tokenAmount: `${totalDebtUsda.toFixed(2)} USDA`, usdValue: debtUsd },
    ],
    totalUsd: collateralUsd - debtUsd,
  };
}

// ─── Zest Protocol ────────────────────────────────────────────────────────────
// Receipt tokens ("zae*") live at deployer SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.
// get-principal-balance(address) → (ok uint)  micro-USDC (6 decimals)
// All current Zest pools are stablecoin-denominated → USD value = balance / 1e6.

const ZEST_RECEIPT_DEPLOYER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";

async function fetchZestPosition(
  address: string,
  fungibleTokens: Record<string, { balance: string }>
): Promise<ProtocolPosition | null> {
  const zestAssets = Object.entries(fungibleTokens).filter(([id]) =>
    id.startsWith(ZEST_RECEIPT_DEPLOYER)
  );
  if (zestAssets.length === 0) return null;

  const lines: PositionLine[] = [];

  await Promise.allSettled(
    zestAssets.map(async ([assetId]) => {
      const contractId = assetId.split("::")[0];
      const dotIndex = contractId.lastIndexOf(".");
      const contractAddr = contractId.slice(0, dotIndex);
      const contractName = contractId.slice(dotIndex + 1);
      // Human-readable token label: "zaeusdc" → "USDC"
      const tokenLabel = assetId.split("::")[1]?.replace(/^zae/, "").toUpperCase() ?? "USD";

      const cv = await callReadOnly(contractAddr, contractName, "get-principal-balance", [
        cvHex(standardPrincipalCV(address)),
      ]);
      const microAmount = parseCV(cv) as number;
      if (microAmount === 0) return;

      const humanAmount = microAmount / 1_000_000;
      lines.push({
        label: "Supplied",
        tokenAmount: `${humanAmount.toFixed(2)} ${tokenLabel}`,
        usdValue: humanAmount,
      });
    })
  );

  if (lines.length === 0) return null;
  return {
    lines,
    totalUsd: lines.reduce((sum, l) => sum + l.usdValue, 0),
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function fetchAllPositions(
  address: string,
  protocols: KnownProtocol[]
): Promise<Map<string, ProtocolPosition | null>> {
  const result = new Map<string, ProtocolPosition | null>();
  const supported = protocols.filter((p) => SUPPORTED_PROTOCOLS.has(p.name));
  if (supported.length === 0) return result;

  // Fetch STX price + token balances once, share across all fetchers
  const [stxPriceData, fungibleTokensData] = await Promise.all([
    getSTXPrice(),
    getFungibleTokens(address),
  ]);
  const stxPrice = stxPriceData.usd;
  const fungibleTokens = (fungibleTokensData.fungible_tokens ?? {}) as Record<
    string,
    { balance: string }
  >;

  const settled = await Promise.allSettled(
    supported.map(async (protocol) => {
      let position: ProtocolPosition | null = null;
      switch (protocol.name) {
        case "StackingDAO":
          position = await fetchStackingDaoPosition(address, stxPrice);
          break;
        case "Lisa":
          position = await fetchLisaPosition(address, stxPrice, fungibleTokens);
          break;
        case "Arkadiko":
          position = await fetchArkadikoPosition(address, stxPrice);
          break;
        case "Zest Protocol":
          position = await fetchZestPosition(address, fungibleTokens);
          break;
      }
      return { name: protocol.name, position };
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      result.set(outcome.value.name, outcome.value.position);
    }
    // rejected outcomes leave the protocol missing from map — handled below
  }

  // Ensure every supported protocol has an entry (null = failed fetch)
  for (const p of supported) {
    if (!result.has(p.name)) result.set(p.name, null);
  }

  return result;
}
