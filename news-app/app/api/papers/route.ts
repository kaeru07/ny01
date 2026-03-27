import { NextResponse } from "next/server";
import { fetchPapers } from "@/lib/fetchPapers";

export const revalidate = 3600; // 1時間キャッシュ

export async function GET() {
  const items = await fetchPapers();
  return NextResponse.json({
    items,
    fetchedAt: new Date().toISOString(),
  });
}
