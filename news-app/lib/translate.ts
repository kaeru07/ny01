/**
 * 翻訳モジュール
 * ANTHROPIC_API_KEY が設定されていれば Claude Haiku で英→日翻訳を実行する。
 * 未設定の場合は null を返し、呼び出し側は元テキストをそのまま使用する。
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;

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
 * 英語テキストを日本語に翻訳する。
 * APIキー未設定またはエラー時は null を返す。
 */
export async function translateToJapanese(text: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!isEnglish(text)) return null; // 既に日本語なら翻訳不要

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: `以下の英語テキストを自然な日本語に翻訳してください。翻訳結果のみを出力し、説明や原文は不要です。\n\n${text}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const translated: string | undefined = data?.content?.[0]?.text;
    return translated?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * 複数テキストをまとめて翻訳する（APIを1回だけ呼ぶ）。
 * 返り値は入力と同じ順序の配列。翻訳できなかった要素は null。
 */
export async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return texts.map(() => null);

  const targets = texts
    .map((t, i) => ({ i, t }))
    .filter(({ t }) => isEnglish(t));

  if (targets.length === 0) return texts.map(() => null);

  const numbered = targets.map(({ i, t }) => `[${i + 1}] ${t}`).join("\n\n");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS * texts.length,
        messages: [
          {
            role: "user",
            content: `以下の番号付き英語テキストをそれぞれ日本語に翻訳してください。同じ番号形式 [N] で翻訳結果のみを出力してください。\n\n${numbered}`,
          },
        ],
      }),
    });

    if (!res.ok) return texts.map(() => null);
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";

    const results: (string | null)[] = texts.map(() => null);
    for (const { i } of targets) {
      const match = raw.match(new RegExp(`\\[${i + 1}\\]\\s*([\\s\\S]*?)(?=\\[\\d+\\]|$)`));
      if (match) results[i] = match[1].trim() || null;
    }
    return results;
  } catch {
    return texts.map(() => null);
  }
}
