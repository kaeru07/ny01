import { NextResponse } from "next/server";
import { mockPapers } from "@/lib/mockData";

// 将来: arXiv API / Semantic Scholar API を統合予定
export async function GET() {
  return NextResponse.json({
    items: mockPapers,
    fetchedAt: new Date().toISOString(),
    note: "論文機能は開発中です。将来的にarXivやSemantic Scholarと統合予定。",
  });
}
