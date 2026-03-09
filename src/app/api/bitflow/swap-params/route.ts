import { NextRequest, NextResponse } from "next/server";
import { bitflow } from "@/lib/bitflow-server";
import type { SwapExecutionData } from "@bitflowlabs/core-sdk";

// Safe serializer — handles bigint values that JSON.stringify cannot handle natively
function safeSerialize(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? { __bigint: v.toString() } : v
    )
  );
}

// Restore { __bigint: "..." } placeholders back to real BigInts (deep)
function deserializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object" && "__bigint" in (obj as object)) {
    return BigInt((obj as { __bigint: string }).__bigint);
  }
  if (Array.isArray(obj)) return obj.map(deserializeBigInts);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deserializeBigInts(v)])
    );
  }
  return obj;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { swapExecutionData, senderAddress, slippage = 0.5 } = body as {
      swapExecutionData: SwapExecutionData;
      senderAddress: string;
      slippage?: number;
    };

    if (!swapExecutionData || !senderAddress) {
      return NextResponse.json({ error: "Missing swapExecutionData or senderAddress" }, { status: 400 });
    }

    // Restore BigInts that were serialized as { __bigint: "..." } during JSON transport
    const restoredData = deserializeBigInts(swapExecutionData) as SwapExecutionData;

    const params = await bitflow.prepareSwap(restoredData, senderAddress, slippage);
    return NextResponse.json(safeSerialize(params));
  } catch (e) {
    console.error("[bitflow/swap-params]", e);
    return NextResponse.json({ error: "Failed to prepare swap" }, { status: 500 });
  }
}
