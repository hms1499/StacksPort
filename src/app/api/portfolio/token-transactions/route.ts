import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { isValidStacksAddress } from "@/lib/server/portfolio-snapshot";

const HIRO_API_BASE = "https://api.hiro.so";
const CACHE_TTL_SECONDS = 30;
const MAX_LIMIT = 20;
const SCAN_PAGE = 50;
const MAX_SCAN_PAGES = 4; // up to 200 txs scanned to find matches

interface FtTransfer {
  asset_identifier: string;
  sender: string | null;
  recipient: string | null;
  amount: string;
}

interface TxWithTransfers {
  tx: {
    tx_id: string;
    tx_type: string;
    tx_status: string;
    sender_address?: string;
    block_time?: number;
    burn_block_time?: number;
    block_height?: number;
    token_transfer?: { recipient_address?: string; amount?: string; memo?: string };
    contract_call?: { contract_id?: string; function_name?: string };
    smart_contract?: { contract_id?: string };
  };
  stx_sent: string;
  stx_received: string;
  ft_transfers?: FtTransfer[];
}

export interface TokenTxRow {
  txId: string;
  txType: string;
  status: "success" | "pending" | "failed";
  timestamp: number;
  direction: "in" | "out" | "neutral";
  amount: number | null; // human-readable, signed (positive = in, negative = out)
  symbol: string;
  contractCall?: { contractId: string; functionName: string };
  counterpart?: string;
}

function cacheKey(address: string, contractId: string, limit: number) {
  return `portfolio:token-tx:${address}:${contractId}:${limit}:v1`;
}

function cacheTags(address: string) {
  return ["portfolio", `portfolio:${address}`];
}

function normaliseStatus(s: string): TokenTxRow["status"] {
  if (s === "success") return "success";
  if (s === "pending") return "pending";
  return "failed";
}

function parseStxRow(item: TxWithTransfers, address: string): TokenTxRow | null {
  const sent = Number(item.stx_sent || 0);
  const received = Number(item.stx_received || 0);
  if (sent === 0 && received === 0 && item.tx.tx_type !== "token_transfer") return null;

  const net = (received - sent) / 1_000_000;
  const direction: TokenTxRow["direction"] = net > 0 ? "in" : net < 0 ? "out" : "neutral";
  const tx = item.tx;
  const tt = tx.token_transfer;

  const counterpart =
    tx.tx_type === "token_transfer"
      ? tx.sender_address === address
        ? tt?.recipient_address
        : tx.sender_address
      : undefined;

  return {
    txId: tx.tx_id,
    txType: tx.tx_type,
    status: normaliseStatus(tx.tx_status),
    timestamp: tx.block_time ?? tx.burn_block_time ?? 0,
    direction,
    amount: net,
    symbol: "STX",
    contractCall:
      tx.tx_type === "contract_call" && tx.contract_call
        ? {
            contractId: tx.contract_call.contract_id ?? "",
            functionName: tx.contract_call.function_name ?? "call",
          }
        : undefined,
    counterpart: counterpart ?? undefined,
  };
}

function parseFtRow(
  item: TxWithTransfers,
  address: string,
  contractId: string,
  decimals: number,
  symbol: string
): TokenTxRow | null {
  const matches = (item.ft_transfers ?? []).filter((ft) => {
    // asset_identifier: "SP...address.contract-name::asset-name"
    const base = ft.asset_identifier.split("::")[0];
    return base === contractId;
  });
  if (matches.length === 0) return null;

  let net = 0;
  let counterpart: string | undefined;
  for (const ft of matches) {
    const amt = Number(ft.amount);
    if (!Number.isFinite(amt)) continue;
    const human = amt / Math.pow(10, decimals);
    if (ft.recipient === address) {
      net += human;
      counterpart = counterpart ?? ft.sender ?? undefined;
    }
    if (ft.sender === address) {
      net -= human;
      counterpart = counterpart ?? ft.recipient ?? undefined;
    }
  }

  if (net === 0) return null;

  const tx = item.tx;
  return {
    txId: tx.tx_id,
    txType: tx.tx_type,
    status: normaliseStatus(tx.tx_status),
    timestamp: tx.block_time ?? tx.burn_block_time ?? 0,
    direction: net > 0 ? "in" : "out",
    amount: net,
    symbol,
    contractCall:
      tx.tx_type === "contract_call" && tx.contract_call
        ? {
            contractId: tx.contract_call.contract_id ?? "",
            functionName: tx.contract_call.function_name ?? "call",
          }
        : undefined,
    counterpart,
  };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const contractId = req.nextUrl.searchParams.get("contractId")?.trim() ?? "";
  const decimals = Number(req.nextUrl.searchParams.get("decimals") ?? "6");
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim() || "TOKEN";
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "8") || 8, 1),
    MAX_LIMIT
  );

  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  if (!contractId) {
    return NextResponse.json({ error: "missing contractId" }, { status: 400 });
  }

  const isStx = contractId === "stx";
  const cache = getCache();
  const key = cacheKey(address, contractId, limit);
  const cached = (await cache.get(key)) as { results: TokenTxRow[] } | null;
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "x-stacksport-cache": "HIT", "Cache-Control": "private, max-age=30" },
    });
  }

  const results: TokenTxRow[] = [];

  for (let page = 0; page < MAX_SCAN_PAGES && results.length < limit; page++) {
    const url =
      `${HIRO_API_BASE}/extended/v1/address/${address}/transactions_with_transfers` +
      `?limit=${SCAN_PAGE}&offset=${page * SCAN_PAGE}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      break;
    }
    if (!res.ok) break;
    const data = (await res.json()) as { results?: TxWithTransfers[] };
    const items = data.results ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const row = isStx
        ? parseStxRow(item, address)
        : parseFtRow(item, address, contractId, decimals, symbol);
      if (row) results.push(row);
      if (results.length >= limit) break;
    }

    if (items.length < SCAN_PAGE) break;
  }

  const payload = { results: results.slice(0, limit) };
  await cache.set(key, payload, {
    ttl: CACHE_TTL_SECONDS,
    tags: cacheTags(address),
    name: "portfolio-token-tx",
  });

  return NextResponse.json(payload, {
    headers: { "x-stacksport-cache": "MISS", "Cache-Control": "private, max-age=30" },
  });
}
