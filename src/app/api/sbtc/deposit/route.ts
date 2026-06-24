import { NextResponse } from "next/server";
import { addPending } from "@/lib/server/sbtc-pending";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { txid, stacksAddress, amountSats, depositScript, reclaimScript } = body as Record<string, string | number>;
  if (typeof txid !== "string" || !txid) return NextResponse.json({ error: "txid required" }, { status: 400 });
  if (typeof stacksAddress !== "string" || !stacksAddress) return NextResponse.json({ error: "stacksAddress required" }, { status: 400 });
  if (typeof amountSats !== "number" || !Number.isInteger(amountSats) || amountSats <= 0)
    return NextResponse.json({ error: "amountSats invalid" }, { status: 400 });

  await addPending({
    txid, stacksAddress, amountSats,
    depositScript: String(depositScript ?? ""),
    reclaimScript: String(reclaimScript ?? ""),
    status: "broadcast",
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
