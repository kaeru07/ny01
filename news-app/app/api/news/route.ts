import { NextRequest, NextResponse } from "next/server";
import { fetchAllNews } from "@/lib/fetchNews";
import { NewsCategory } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 300; // 5分キャッシュ

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as NewsCategory | "all" | null;

  try {
    const items = await fetchAllNews();
    const filtered =
      !category || category === "all"
        ? items
        : items.filter((n) => n.category === category);

    return NextResponse.json({
      items: filtered,
      fetchedAt: new Date().toISOString(),
      sources: Array.from(new Set(filtered.map((n) => n.source))),
    });
  } catch (err) {
    console.error("[GET /api/news] error:", err);
    return NextResponse.json(
      { error: "ニュースの取得に失敗しました" },
      { status: 500 }
    );
  }
}
