import { addPromptQueueItem, readPromptQueueRegistry } from './prompt-queue'
import { buildKnownAppsBrief, readMarketResearch } from './app-market-research'
import { readGoals } from './goal-reader'

// ─────────────────────────────────────────────────────────────
// App Market Research を「自動実行のたびに1回」流すための仕込み。
//
// 調査そのものは executor（Claude / Codex）が Web を見て行う。ここでは
// 毎回の定時起動で作業予約（Prompt Queue）に1件だけ積み、既存の dispatch と
// 安全ゲートに乗せる。二重に積まないよう、未完了の同種タスクがあれば何もしない。
// ─────────────────────────────────────────────────────────────

export const MARKET_RESEARCH_TITLE_PREFIX = 'App Store ヒット調査'
const MARKET_RESEARCH_GOAL_ID = 'goal-app-market-research'
const OPEN_STATUSES = new Set(['queued', 'running', 'reserved', 'needs_retry'])

/** 調査対象の条件と記録方法。executor はこの文章だけを見て作業できる必要がある。 */
export function buildMarketResearchPrompt(knownApps: string): string {
  return `日本の App Store を中心に、個人開発者・小規模法人・小規模チームが出していて「実際にヒットしている」アプリを調査し、progress に構造化して記録する。

## 今回の件数
原則3本前後。優先順は (1) 新規で条件を満たす有力アプリ (2) 既出だが前回から明確な変化があるアプリ (3) 条件の弱い候補。
**3本にするために弱いアプリを無理に入れない。有力な新規が1本しかなければ1本でよい。**
重要な変化がない既出アプリは取り上げない。

## 対象と除外
- 対象の開発者: 個人名義 / 小規模法人 / 小規模チーム
- 除外: 上場企業・大手・大規模ゲーム会社・有名サービス運営企業・実質大規模なパブリッシャー
- 開発者規模は individual（個人）/ small_company（小規模法人）/ unknown（規模不明）/ excluded（除外）で分類する。unknown は本採用候補にせず参考候補扱い
- 収益モデルは無料DL＋広告 / 無料DL＋アプリ内課金 / 無料DL＋サブスク（およびその組み合わせ）のみが対象。**買い切り・有料DLは除外**

## ヒット判定（両方を同じくらい重視する）
- surging（急上昇型）: 直近30日程度でランキングが大きく上昇、評価件数・レビュー件数・Google Play DL が明確に増加。**リリースから6〜12か月以内でカテゴリ50位以内なら強く評価する**
- sustained（継続ヒット型）: 数か月以上カテゴリ上位を維持、評価件数が継続的に増加、Android でも高DL
- both（両方）: 両方に該当。最優先候補として扱う

## 禁止
- 単なるアイデア出しは禁止。現在のランキング・過去のランキング推移・評価件数・Android DL数など、**実績を確認できたアプリだけ**を根拠URL付きで扱う
- 確認できなかった項目を推測で埋めない。確認できない場合は値を null にする（文章項目は「確認できない」と書く）

## 調査の進め方
1. まず既出アプリ一覧（下記）を読む。既出は「新規候補」にせず「既出アプリ更新」として扱い、前回との差分を中心に出す
2. App Store 公式・Google Play 公式を優先。ランキング推移など公式で確認できないものは APPLION / AppRankNavi / Sensor Tower などの信頼できる情報を複数照合する
3. 情報源URLは必ず記録する

## 既出アプリ（重複登録しないこと）
${knownApps}

## 記録方法（必須）
調査結果は必ず progress へ POST する。チャットに書くだけでは蓄積されない。

\`\`\`
POST http://localhost:3010/api/app-market-research
Content-Type: application/json
Basic 認証あり（apps/ny01/progress/.env.local の BASIC_AUTH_USER / BASIC_AUTH_PASSWORD）

{"apps":[{
  "appName":"...", "developer":"...",
  "developerScale":"individual|small_company|unknown|excluded",
  "appStoreUrl":"https://apps.apple.com/jp/app/.../idXXXXXXXXX",
  "googlePlayUrl":"... または null", "androidAvailable":true,
  "releaseDate":"2025-03-01 または null", "ageSinceRelease":"約11か月 または null",
  "category":"ユーティリティ など",
  "serverBurden":"low|medium|high|unknown",
  "operationBurden":"low|medium|high|unknown",
  "contentBurden":"low|medium|high|unknown",
  "ipRequirement":"不要 / 要 など", "whyGrowing":"なぜ伸びたか", "differentiation":"作るなら何を変えるか",
  "snapshot":{
    "hitType":"surging|sustained|both",
    "currentCategoryRank":18, "currentOverallRank":null,
    "rankTrend30d":"42位→18位（+24）", "longTermHitEvidence":"5か月連続でカテゴリ30位以内",
    "ratingCount":1140, "reviewCount":210,
    "googlePlayDownloads":"50万+", "googlePlayRatingCount":8200,
    "monetization":"ads|iap|subscription|mixed",
    "reproducibility":4,
    "updateNote":"直近アップデート内容", "note":"補足",
    "sourceUrls":["https://...","https://..."]
  }
}]}
\`\`\`

同じアプリを再調査した場合も**同じ appStoreUrl で POST すれば行は増えず履歴が積まれる**。新しい行を作らないこと。

## 再現性（reproducibility ★1〜5）の付け方
高くする: サーバー不要か軽量 / 版権不要 / ロジックが単純 / UIが複雑でない / AI生成で効率化できる / 1人で保守できる / 広告と相性が良い / 少ない機能で価値が成立 / 開発期間が短い / テーマ替えで横展開しやすい
低くする: 動画SNS / 大規模SNS / 大量UGCのモデレーション / リアルタイムマルチプレイ必須 / 大規模サーバー / 有名IP依存 / 数百〜数千ステージの人力制作 / 大人数の運営が必要 / 外部企業との契約や特殊データが必要

## 報告フォーマット（長くしない）
\`\`\`
■ 新規候補
1. アプリ名
   ・ヒットタイプ
   ・主な伸び根拠
   ・再現性
   ・一言評価

■ 既出アプリの差分
・アプリ名
  順位：前回 → 今回
  評価：前回 → 今回
  DL：前回 → 今回
（差分がない場合はこの節を出さない）
\`\`\`
最後に「今回、個人＋AIで作る価値が高い順」を1行ずつで示す。`
}

export interface EnsureMarketResearchResult {
  created: boolean
  reason: string
  itemId?: string
}

/**
 * 定時起動のたびに呼ぶ。未完了の調査タスクが無ければ1件だけ積む。
 * 調査タスクが溜まって自動実行を圧迫しないよう、常に1件までしか存在させない。
 */
export async function ensureMarketResearchTask(): Promise<EnsureMarketResearchResult> {
  const registry = await readPromptQueueRegistry()
  const open = registry.items.find(
    (item) => item.title?.startsWith(MARKET_RESEARCH_TITLE_PREFIX) && OPEN_STATUSES.has(item.status),
  )
  if (open) return { created: false, reason: '未完了の調査タスクが既にある', itemId: open.id }

  const goalsData = await readGoals()
  const goal = goalsData.goals.find((item) => item.id === MARKET_RESEARCH_GOAL_ID)
  if (!goal) return { created: false, reason: `調査用ゴール（${MARKET_RESEARCH_GOAL_ID}）が未作成` }

  const store = await readMarketResearch()
  const today = new Date().toISOString().slice(0, 10)
  const item = await addPromptQueueItem({
    title: `${MARKET_RESEARCH_TITLE_PREFIX}（${today}）: 個人・小規模開発のヒットアプリを3本前後`,
    prompt: buildMarketResearchPrompt(buildKnownAppsBrief(store)),
    projectId: goal.projectId ?? 'app-market-research',
    goalProgressId: MARKET_RESEARCH_GOAL_ID,
    source: 'goal_progress',
    notes: `既出${store.apps.length}件。結果は POST /api/app-market-research で保存し、App Market Research 画面に蓄積する。`,
  })
  return { created: true, reason: `調査タスクを1件予約（既出${store.apps.length}件）`, itemId: item.id }
}
