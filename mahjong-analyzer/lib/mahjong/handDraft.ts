const HAND_DRAFT_KEY = "mahjong-analyzer:hand-draft";
export const MAX_HAND_INPUT_LENGTH = 64;

/**
 * 下書き保存に必要な最小インターフェース。
 *
 * DOM の `Storage` 型へ依存させないことで、解析ロジックと同様にこの入力検証を
 * Expo 側のストレージアダプターからも再利用できるようにする。
 */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

/** Expo AsyncStorage など、非同期の端末ストレージに必要な最小インターフェース。 */
export interface AsyncDraftStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
}

const DEFAULT_DRAFT_LOAD_TIMEOUT_MS = 3_000;
const DRAFT_LOAD_TIMED_OUT = Symbol("draft-load-timed-out");

function isValidHandDraft(input: string): boolean {
  if (input.length > MAX_HAND_INPUT_LENGTH) return false;

  const normalized = input.normalize("NFKC").toLowerCase();
  // 空白だけの値は未入力として扱う。再起動後に見た目は空なのに
  // 「下書きあり」の状態へ戻ることを防ぐ。
  if (!normalized.trim()) return false;
  if (!/^[0-9mpsz\s]*$/.test(normalized)) return false;

  // 入力途中の末尾数字（例: "123m45"）は保存する一方、数字を伴わない
  // スーツや存在しない牌は、壊れた保存値として起動時に復元しない。
  const compact = normalized.replace(/\s+/g, "");
  let pendingDigits = "";
  const tileCounts = new Map<string, number>();
  const redFiveSuits = new Set<string>();
  for (const character of compact) {
    if (/\d/.test(character)) {
      pendingDigits += character;
      continue;
    }

    if (!pendingDigits) return false;
    for (const digit of pendingDigits) {
      if (
        character === "z"
          ? digit < "1" || digit > "7"
          : digit !== "0" && (digit < "1" || digit > "9")
      ) {
        return false;
      }

      if (digit === "0") {
        if (redFiveSuits.has(character)) return false;
        redFiveSuits.add(character);
      }

      // 赤5と通常5は同じ牌として数える。入力途中でも物理的に存在しない
      // 5枚目へ達した値は保存せず、再起動後に修正必須の状態へ戻さない。
      const tileKey = `${digit === "0" ? "5" : digit}${character}`;
      const tileCount = (tileCounts.get(tileKey) ?? 0) + 1;
      if (tileCount > 4) return false;
      tileCounts.set(tileKey, tileCount);
    }
    pendingDigits = "";
  }

  // 解析対象は最大14枚。入力欄で15枚目に達した値を次回起動時まで
  // 復元すると、起動直後から修正必須の状態になるため保存しない。
  const tileCount = (normalized.match(/[0-9]/g) ?? []).length;
  return tileCount <= 14;
}

export function loadHandDraft(storage: DraftStorage | null): string {
  if (!storage) return "";

  try {
    const draft = storage.getItem(HAND_DRAFT_KEY) ?? "";
    // 保存値はユーザーが編集した牌表記だけを受け入れる。旧版や外部要因で
    // localStorage が壊れていても、フォームへ不正な文字列を復元しない。
    if (!isValidHandDraft(draft)) {
      storage.removeItem(HAND_DRAFT_KEY);
      return "";
    }

    return draft;
  } catch {
    return "";
  }
}

export function saveHandDraft(
  storage: DraftStorage | null,
  input: string
): boolean {
  if (!storage) return false;

  try {
    if (input && isValidHandDraft(input)) {
      storage.setItem(HAND_DRAFT_KEY, input);
    } else {
      storage.removeItem(HAND_DRAFT_KEY);
    }
    return true;
  } catch {
    // Safariのプライベートブラウズなど、保存不可でも解析は継続できる。
    return false;
  }
}

/**
 * Expo 版で保存した下書きを復元する。
 *
 * 壊れた保存値は端末から削除し、ストレージ自体が利用できない場合も
 * 空の入力へフォールバックしてアプリの起動を継続する。
 */
export async function loadHandDraftAsync(
  storage: AsyncDraftStorage | null,
  timeoutMs = DEFAULT_DRAFT_LOAD_TIMEOUT_MS
): Promise<string> {
  if (!storage) return "";

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // 端末ストレージが応答しない場合も、起動画面を復元中のままにしない。
    // 読み込み自体は中断できないため、期限後は空の入力で利用を継続する。
    const storedDraft = await Promise.race([
      storage.getItem(HAND_DRAFT_KEY),
      new Promise<typeof DRAFT_LOAD_TIMED_OUT>((resolve) => {
        timeoutId = setTimeout(
          () => resolve(DRAFT_LOAD_TIMED_OUT),
          Math.max(0, timeoutMs)
        );
      }),
    ]);
    if (storedDraft === DRAFT_LOAD_TIMED_OUT) return "";

    const draft = storedDraft ?? "";
    if (!isValidHandDraft(draft)) {
      await storage.removeItem(HAND_DRAFT_KEY);
      return "";
    }

    return draft;
  } catch {
    return "";
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Expo 版の入力途中の手牌を端末内だけに保存する。 */
export async function saveHandDraftAsync(
  storage: AsyncDraftStorage | null,
  input: string
): Promise<boolean> {
  if (!storage) return false;

  try {
    if (input && isValidHandDraft(input)) {
      await storage.setItem(HAND_DRAFT_KEY, input);
    } else {
      await storage.removeItem(HAND_DRAFT_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 連続入力時も保存順を保証する Expo 向け保存関数を作る。
 *
 * AsyncStorage の書き込みを入力ごとに並行実行すると、先に始めた古い保存が
 * 後から完了し、再起動時に古い手牌へ戻る可能性がある。呼び出し順に処理する
 * ことで、最後に入力された値が必ず最後に保存されるようにする。
 */
export function createQueuedHandDraftSaver(storage: AsyncDraftStorage | null) {
  let queue: Promise<unknown> = Promise.resolve();

  return (input: string): Promise<boolean> => {
    const operation = queue.then(() => saveHandDraftAsync(storage, input));
    queue = operation.catch(() => undefined);
    return operation;
  };
}
