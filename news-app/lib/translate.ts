/**
 * 翻訳モジュール
 * Google翻訳の非公式APIを利用した無料翻訳。
 * 翻訳失敗時はnullを返し、呼び出し側は元テキストをそのまま使用する。
 */

const GTRANS_URL = "https://translate.googleapis.com/translate_a/single";

/** テキストが主に英語かどうかを判定
 * - ひらがな・カタカナ・漢字が1文字でもあれば日本語として扱う
 * - それ以外は英字比率が50%超なら英語と見なす
 */
export function isEnglish(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  // 日本語文字（ひらがな U+3040–309F、カタカナ U+30A0–30FF、CJK漢字 U+4E00–9FFF）
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) return false;
  const ascii = text.split("").filter((c) => /[a-zA-Z]/.test(c)).length;
  const letters = text.split("").filter((c) => /\p{L}/u.test(c)).length;
  if (letters === 0) return false;
  return ascii / letters > 0.5;
}

/**
 * Google翻訳の非公式APIで英語→日本語翻訳。
 * 失敗時はnullを返す。
 */
async function googleTranslate(text: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "ja",
      dt: "t",
      q: text,
    });
    const res = await fetch(`${GTRANS_URL}?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 }, // 翻訳結果を1日キャッシュ
    });
    if (!res.ok) return null;
    const data = await res.json();
    // レスポンス形式: [[["翻訳テキスト","原文",...],...], null, "en"]
    const parts: string[] = (data?.[0] ?? [])
      .map((item: unknown[]) => item?.[0])
      .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
    return parts.length > 0 ? parts.join("") : null;
  } catch {
    return null;
  }
}

/**
 * 英語テキストを日本語に翻訳する。
 * 日本語テキストまたはエラー時はnullを返す。
 */
export async function translateToJapanese(text: string): Promise<string | null> {
  if (!text || text.trim().length === 0) return null;
  if (!isEnglish(text)) return null;
  return googleTranslate(text);
}

/**
 * 複数テキストをまとめて翻訳する（英語のみ対象、並列実行）。
 * 返り値は入力と同じ順序の配列。翻訳できなかった要素はnull。
 */
export async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  const results: (string | null)[] = texts.map(() => null);
  const targets = texts.map((t, i) => ({ i, t })).filter(({ t }) => isEnglish(t));

  if (targets.length === 0) return results;

  await Promise.all(
    targets.map(async ({ i, t }) => {
      results[i] = await googleTranslate(t);
    })
  );

  return results;
}
