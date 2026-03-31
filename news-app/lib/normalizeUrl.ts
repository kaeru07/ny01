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
 * Hacker News の discussion URL を生成（記事URLが無効な場合のフォールバック）
 */
export function hnFallbackUrl(hnId: number): string {
  return `https://news.ycombinator.com/item?id=${hnId}`;
}

/**
 * RSSのXML実体参照をデコードする。
 * BBCなど一部RSSフィードは <link> 内に &amp; 等を含む。
 */
export function xmlDecodeUrl(url: string): string {
  return url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * URLから決定論的な安定IDを生成する（FNV-1a 32-bit hash）。
 * Date.now() を使わず、同じURLからは常に同じIDを返す。
 *
 * @param prefix - ソース識別子 ("nhk", "bbc", "zenn" など)
 * @param url    - 記事URL（guidが望ましい）
 */
export function stableId(prefix: string, url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${prefix}-${h.toString(36)}`;
}
