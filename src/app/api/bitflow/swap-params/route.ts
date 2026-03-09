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

    const params = await bitflow.prepareSwap(swapExecutionData, senderAddress, slippage);
    return NextResponse.json(safeSerialize(params));
  } catch (e) {
    console.error("[bitflow/swap-params]", e);
    return NextResponse.json({ error: "Failed to prepare swap" }, { status: 500 });
  }
}
