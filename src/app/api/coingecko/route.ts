import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Specify a path, e.g. /api/coingecko/simple/price" }, { status: 400 });
}
