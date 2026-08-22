import assert from "node:assert/strict";
import test from "node:test";
import {
  createQueuedHandDraftSaver,
  type AsyncDraftStorage,
  type DraftStorage,
  loadHandDraft,
  loadHandDraftAsync,
  MAX_HAND_INPUT_LENGTH,
  saveHandDraft,
  saveHandDraftAsync,
} from "./handDraft";

function createStorage(): DraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function createAsyncStorage(): AsyncDraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => values.set(key, value),
    removeItem: async (key: string) => values.delete(key),
  };
}

test("入力中の手牌を端末内に保存して復元する", () => {
  const storage = createStorage();

  assert.equal(saveHandDraft(storage, "123m456p789s11z12m"), true);

  assert.equal(loadHandDraft(storage), "123m456p789s11z12m");
});

test("クリア時は保存した手牌も削除する", () => {
  const storage = createStorage();
  saveHandDraft(storage, "123m456p789s11z12m");

  saveHandDraft(storage, "");

  assert.equal(loadHandDraft(storage), "");
});

test("空白だけの入力は未入力として保存しない", () => {
  const storage = createStorage();
  saveHandDraft(storage, "123m456p789s11z12m");

  saveHandDraft(storage, "  \n\t");

  assert.equal(loadHandDraft(storage), "");
  assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
});

test("端末ストレージが利用できなくても例外にしない", () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error("unavailable");
    },
    setItem: () => {
      throw new Error("unavailable");
    },
    removeItem: () => {
      throw new Error("unavailable");
    },
  };

  assert.equal(loadHandDraft(unavailableStorage), "");
  assert.equal(saveHandDraft(unavailableStorage, "123m"), false);
  assert.equal(loadHandDraft(null), "");
  assert.equal(saveHandDraft(null, "123m"), false);
});

test("異常に長い保存値は復元しない", () => {
  const storage = createStorage();
  storage.setItem("mahjong-analyzer:hand-draft", "1".repeat(MAX_HAND_INPUT_LENGTH + 1));

  assert.equal(loadHandDraft(storage), "");
  assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
});

test("不正な文字を含む保存値は復元しない", () => {
  const storage = createStorage();
  storage.setItem("mahjong-analyzer:hand-draft", "<script>alert(1)</script>");

  assert.equal(loadHandDraft(storage), "");
  assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
});

test("牌表記として成立し得ない保存値は復元しない", () => {
  for (const invalidDraft of [
    "9z",
    "0z",
    "m",
    "123mm",
    "00m123p456s123z",
    "05555m123p456s1z",
  ]) {
    const storage = createStorage();
    storage.setItem("mahjong-analyzer:hand-draft", invalidDraft);

    assert.equal(loadHandDraft(storage), "", invalidDraft);
    assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
  }
});

test("スーツ入力前の末尾数字は入力途中として復元する", () => {
  const storage = createStorage();
  storage.setItem("mahjong-analyzer:hand-draft", "123m45");

  assert.equal(loadHandDraft(storage), "123m45");
});

test("不正または上限超過の入力は端末へ保存しない", () => {
  const storage = createStorage();
  saveHandDraft(storage, "123m456p789s11z12m");

  saveHandDraft(storage, "<script>");
  assert.equal(loadHandDraft(storage), "");

  saveHandDraft(storage, "1".repeat(MAX_HAND_INPUT_LENGTH + 1));
  assert.equal(loadHandDraft(storage), "");
  assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
});

test("15枚以上の入力は保存せず旧保存値も復元しない", () => {
  const storage = createStorage();
  const fifteenTiles = "123456789m123456p";

  saveHandDraft(storage, fifteenTiles);
  assert.equal(loadHandDraft(storage), "");

  storage.setItem("mahjong-analyzer:hand-draft", fifteenTiles);
  assert.equal(loadHandDraft(storage), "");
  assert.equal(storage.getItem("mahjong-analyzer:hand-draft"), null);
});

test("パーサーが対応する全角入力と空白はそのまま復元する", () => {
  const storage = createStorage();
  const draft = "１２３ｍ ４５６ｐ ７８９ｓ １１ｚ １２ｍ";
  storage.setItem("mahjong-analyzer:hand-draft", draft);

  assert.equal(loadHandDraft(storage), draft);
});

test("Expo向け非同期ストレージへ下書きを保存して復元する", async () => {
  const storage = createAsyncStorage();

  assert.equal(
    await saveHandDraftAsync(storage, "123m456p789s11z12m"),
    true
  );
  assert.equal(
    await loadHandDraftAsync(storage),
    "123m456p789s11z12m"
  );

  await saveHandDraftAsync(storage, "");
  assert.equal(await loadHandDraftAsync(storage), "");
});

test("連続した非同期保存は入力順に完了し最新の下書きを残す", async () => {
  const values = new Map<string, string>();
  const started: string[] = [];
  let releaseFirstWrite: (() => void) | undefined;
  const firstWriteGate = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  const storage: AsyncDraftStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      started.push(value);
      if (started.length === 1) await firstWriteGate;
      values.set(key, value);
    },
    removeItem: async (key) => values.delete(key),
  };
  const saveDraft = createQueuedHandDraftSaver(storage);

  const firstSave = saveDraft("123m");
  const secondSave = saveDraft("456p");
  await Promise.resolve();
  assert.deepEqual(started, ["123m"]);

  releaseFirstWrite?.();
  assert.deepEqual(await Promise.all([firstSave, secondSave]), [true, true]);
  assert.deepEqual(started, ["123m", "456p"]);
  assert.equal(await loadHandDraftAsync(storage), "456p");
});

test("非同期ストレージの不正値と障害を安全に処理する", async () => {
  const storage = createAsyncStorage();
  await storage.setItem("mahjong-analyzer:hand-draft", "123456789m123456p");

  assert.equal(await loadHandDraftAsync(storage), "");
  assert.equal(
    await storage.getItem("mahjong-analyzer:hand-draft"),
    null
  );

  const unavailableStorage: AsyncDraftStorage = {
    getItem: async () => {
      throw new Error("unavailable");
    },
    setItem: async () => {
      throw new Error("unavailable");
    },
    removeItem: async () => {
      throw new Error("unavailable");
    },
  };

  assert.equal(await loadHandDraftAsync(unavailableStorage), "");
  assert.equal(await saveHandDraftAsync(unavailableStorage, "123m"), false);
  assert.equal(await loadHandDraftAsync(null), "");
  assert.equal(await saveHandDraftAsync(null, "123m"), false);
});

test("端末ストレージの読み込みが応答しなくても復元を終了する", async () => {
  const hangingStorage: AsyncDraftStorage = {
    getItem: () => new Promise<string | null>(() => undefined),
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };

  const startedAt = Date.now();
  assert.equal(await loadHandDraftAsync(hangingStorage, 10), "");
  assert.ok(Date.now() - startedAt < 500);
});
