import { NextResponse } from "next/server";
import { bitflow } from "@/lib/bitflow-server";

export async function GET() {
  try {
    const tokens = await bitflow.getAvailableTokens();
    return NextResponse.json(tokens, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    console.error("[bitflow/tokens]", e);
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
