import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getResearchScanMeta } from "@/lib/research/vault";

/**
 * 市場調査ビューの手動再スキャン。
 * - /research（および配下）のキャッシュを revalidate し、Vault Markdown を再読込させる
 * - 最新のスキャンメタを返す（ボタン側で結果表示に使う）
 */
export async function POST() {
  revalidatePath("/research");
  revalidatePath("/research", "layout");
  const meta = await getResearchScanMeta();
  return NextResponse.json({ ok: true, meta });
}
