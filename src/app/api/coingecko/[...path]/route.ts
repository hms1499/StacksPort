import { NextRequest, NextResponse } from "next/server";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join("/");

  const qs = req.nextUrl.searchParams.toString();
  const url = `${COINGECKO_BASE}/${apiPath}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { next: { revalidate: 60 } });

  if (!res.ok) {
    return NextResponse.json({ error: "CoinGecko error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
