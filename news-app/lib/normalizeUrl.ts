/**
 * URL正規化・バリデーション
 * 無効なURL（example.com、localhost、空文字等）を除去する
 */

const INVALID_HOSTS = new Set([
  "example.com",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

/**
 * URLを正規化して返す。無効なURLはnullを返す。
 * - http/https のみ許可
 * - example.com / localhost 等は無効
 * - 空・undefined も無効
 */
export function normalizeUrl(url: string | undefined | null): string | null {
  if (!url || url.trim() === "") return null;
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (INVALID_HOSTS.has(parsed.hostname)) return null;
    // example.com のサブドメインも除外
    if (parsed.hostname.endsWith(".example.com")) return null;
    return url.trim();
  } catch {
    return null;
  }
}

/**
 * Hacker News の HN discussion URL を生成（記事URLが無効な場合のフォールバック）
 */
export function hnFallbackUrl(hnId: number): string {
  return `https://news.ycombinator.com/item?id=${hnId}`;
}
