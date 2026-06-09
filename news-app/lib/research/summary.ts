import {
  Priority,
  ResearchDoc,
  ResearchTopic,
  TodoCandidate,
  TopicRef,
} from "./types";

/** stale 判定の既定しきい値（日）。sourceDate がこれ以上前なら古い扱い。 */
export const STALE_DAYS = 30;

/** 一覧カードや概要表示用に、1 日次レポートのトピック統計を集計する。 */
export interface DocTopicSummary {
  topicCount: number;
  sCount: number;
  aCount: number;
  todoCount: number;
  staleCount: number;
  topTags: string[];
  tlDr: string;
}

export function summarizeDocTopics(doc: ResearchDoc): DocTopicSummary | null {
  const st = doc.structured;
  if (!st || st.topics.length === 0) return null;

  const counts = new Map<string, number>();
  for (const t of st.topics) {
    for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const topTags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map((e) => e[0]);

  const conclusionLine = st.conclusion
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  const tlDr =
    conclusionLine ?? st.topics[0].summaryTlDr ?? st.topics[0].title;

  return {
    topicCount: st.topics.length,
    sCount: st.topics.filter((t) => t.importance === "S").length,
    aCount: st.topics.filter((t) => t.importance === "A").length,
    todoCount: st.topics.filter((t) => t.todoCandidate).length,
    staleCount: st.topics.filter((t) => isStale(effectiveSourceDate(t, doc.date)))
      .length,
    topTags,
    tlDr,
  };
}

/** Topic の情報日付。sourceDate が無ければ日次ファイルの日付を使う。 */
export function effectiveSourceDate(
  topic: ResearchTopic,
  fallbackDate: string
): string {
  return topic.sourceDate || fallbackDate;
}

/**
 * sourceDate が基準日（既定: 今日）から STALE_DAYS 以上前なら true。
 * 不正な日付は stale 扱いしない（false）。
 */
export function isStale(
  sourceDate: string | undefined,
  refDate: Date = new Date(),
  days: number = STALE_DAYS
): boolean {
  if (!sourceDate) return false;
  const t = Date.parse(sourceDate);
  if (Number.isNaN(t)) return false;
  const diffDays = (refDate.getTime() - t) / (1000 * 60 * 60 * 24);
  return diffDays >= days;
}

/** todoCandidate な Topic を Progress 連携用の正規化 shape へ変換（生成準備のみ）。 */
export function toTodoCandidate(ref: TopicRef): TodoCandidate {
  const { topic } = ref;
  return {
    title: topic.title,
    priority: topic.importance,
    sourceTopicId: topic.topicId ?? "",
    sourceDate: topic.sourceDate || ref.date,
    sourceCategory: ref.category,
    summary: topic.summaryTlDr ?? topic.summary[0] ?? "",
    nextActions: topic.nextActions,
  };
}

const PRIORITY_ORDER: Record<Priority, number> = { S: 0, A: 1, B: 2, C: 3 };

/** 重要度（S>A>B>C）→ 日付新しい順 で TopicRef を並べる。 */
export function sortByImportanceThenDate(refs: TopicRef[]): TopicRef[] {
  return [...refs].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.topic.importance] - PRIORITY_ORDER[b.topic.importance];
    if (pa !== 0) return pa;
    const da = a.topic.updatedAt || a.date;
    const db = b.topic.updatedAt || b.date;
    return db.localeCompare(da);
  });
}
