import { NextRequest, NextResponse } from "next/server";
import { bitflow } from "@/lib/bitflow-server";

function safeSerialize(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? { __bigint: v.toString() } : v
    )
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const amount = Number(searchParams.get("amount") ?? "0");

  if (!from || !to || !amount) {
    return NextResponse.json({ error: "Missing params: from, to, amount" }, { status: 400 });
  }

  try {
    const result = await bitflow.getQuoteForRoute(from, to, amount);
    return NextResponse.json(safeSerialize(result));
  } catch (e) {
    console.error("[bitflow/quote]", e);
    return NextResponse.json({ error: "Failed to get quote" }, { status: 500 });
  }
}
