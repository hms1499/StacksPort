import { NextResponse } from "next/server";
import { listForAddress } from "@/lib/server/sbtc-pending";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const deposits = await listForAddress(address);
  return NextResponse.json({ deposits });
}
