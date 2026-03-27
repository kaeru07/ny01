import { isEnglish, translateToJapanese, translateBatch } from "../lib/translate";

describe("isEnglish", () => {
  test("英語テキストを英語と判定する", () => {
    expect(isEnglish("New AI model improves reasoning")).toBe(true);
  });

  test("日本語テキストを英語と判定しない", () => {
    expect(isEnglish("新しいAIモデルが推論性能を向上")).toBe(false);
  });

  test("空文字は英語と判定しない", () => {
    expect(isEnglish("")).toBe(false);
  });

  test("数字だけは英語と判定しない", () => {
    expect(isEnglish("12345")).toBe(false);
  });

  test("日英混在でも日本語主体なら英語と判定しない", () => {
    expect(isEnglish("TypeScriptの新機能")).toBe(false);
  });

  test("英語主体の混在テキストは英語と判定する", () => {
    expect(isEnglish("OpenAI releases GPT-5 model for API")).toBe(true);
  });
});

describe("translateToJapanese", () => {
  beforeEach(() => {
    // APIキーなしの環境でテスト
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("APIキーなしは null を返す", async () => {
    const result = await translateToJapanese("New AI model improves reasoning");
    expect(result).toBeNull();
  });

  test("日本語テキストはスキップして null を返す", async () => {
    const result = await translateToJapanese("すでに日本語のテキスト");
    expect(result).toBeNull();
  });
});

describe("translateBatch", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("APIキーなしは全て null の配列を返す", async () => {
    const results = await translateBatch(["Hello", "World", "Test"]);
    expect(results).toEqual([null, null, null]);
  });

  test("空配列は空配列を返す", async () => {
    const results = await translateBatch([]);
    expect(results).toEqual([]);
  });

  test("入力と同じ長さの配列を返す", async () => {
    const inputs = ["Hello", "World"];
    const results = await translateBatch(inputs);
    expect(results).toHaveLength(inputs.length);
  });
});
