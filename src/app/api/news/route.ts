import { NextResponse } from "next/server";
import { fetchNews, type NewsItem } from "@/lib/server/news";

export type { NewsItem };

export async function GET() {
  const items = await fetchNews();
  return NextResponse.json(items);
}
