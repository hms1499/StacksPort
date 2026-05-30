import { NextRequest, NextResponse } from "next/server";
import { validateConfigInput, type SmartDcaConfig } from "@/lib/smart-dca";
import {
  getConfigsForOwner, getConfig, putConfig, deleteConfig,
} from "@/lib/smart-dca-redis";

export const dynamic = "force-dynamic";

// GET /api/dca/smart?address=SP... → that owner's configs
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!address) return NextResponse.json({ configs: [] });
  try {
    const configs = await getConfigsForOwner(address);
    return NextResponse.json({ configs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ configs: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

// POST /api/dca/smart  { address, planId, thresholdBps, windowDays, maxDeferIntervals }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const address = String(body.address ?? "").trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const input = {
    planId: Number(body.planId),
    thresholdBps: Number(body.thresholdBps),
    windowDays: Number(body.windowDays),
    maxDeferIntervals: Number(body.maxDeferIntervals),
  };
  const v = validateConfigInput(input);
  if (!v.ok) return NextResponse.json({ error: "invalid", details: v.errors }, { status: 400 });

  // Ownership guard: if a config already exists for this plan, only its owner may edit it.
  const existing = await getConfig(input.planId);
  if (existing && existing.owner.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "not owner" }, { status: 403 });
  }

  const cfg: SmartDcaConfig = {
    owner: address,
    thresholdBps: input.thresholdBps,
    windowDays: input.windowDays,
    maxDeferIntervals: input.maxDeferIntervals,
    createdAt: existing?.createdAt ?? Math.floor(Date.now() / 1000),
  };
  await putConfig(input.planId, cfg);
  return NextResponse.json({ ok: true, config: { planId: input.planId, ...cfg } });
}

// DELETE /api/dca/smart  { address, planId }
export async function DELETE(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const address = String(body.address ?? "").trim();
  const planId = Number(body.planId);
  if (!address || !Number.isInteger(planId)) {
    return NextResponse.json({ error: "address and integer planId required" }, { status: 400 });
  }
  const existing = await getConfig(planId);
  if (existing && existing.owner.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "not owner" }, { status: 403 });
  }
  await deleteConfig(planId);
  return NextResponse.json({ ok: true });
}
