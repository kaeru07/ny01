'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProjectStatus, Todo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileJson, BookOpen } from 'lucide-react';
import Link from 'next/link';

type FormData = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

interface ProjectFormProps {
  initialData?: Project;
  onSubmit: (data: FormData) => Promise<void>;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: '未着手' },
  { value: 'active', label: '進行中' },
  { value: 'adjusting', label: '調整中' },
  { value: 'done', label: '完了' },
  { value: 'paused', label: '保留' },
];

// Supabase エラーは Error インスタンスではなく { message, code, details, hint } 形式
type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function isSupabaseErrorLike(err: unknown): err is SupabaseErrorLike {
  return err !== null && typeof err === 'object' && 'message' in err;
}

function extractErrorInfo(err: unknown): { msg: string; code?: string; details?: string; hint?: string } {
  // Supabase の PostgrestError は plain object（Error インスタンスではない）だが、
  // 念のり Error インスタンスでも code/details/hint を取り出せるよう両方チェックする
  if (isSupabaseErrorLike(err)) {
    return {
      msg: err.message ?? JSON.stringify(err),
      code: err.code,
      details: err.details,
      hint: err.hint,
    };
  }
  if (err instanceof Error) return { msg: err.message };
  if (typeof err === 'string') return { msg: err };
  try { return { msg: JSON.stringify(err) }; } catch { return { msg: String(err) }; }
}

function toUserMessage(err: unknown): string {
  // 開発用: 生のエラーオブジェクトをコンソールに出力
  console.error('[ProjectForm] ❌ 保存エラー (raw):', err);

  const { msg, code, details, hint } = extractErrorInfo(err);

  console.error('[ProjectForm] エラー詳細:', { message: msg, code, details, hint });

  // ユーザー向けメッセージ生成（DB エラーコードを優先して評価）
  const lower = msg.toLowerCase();
  if (code === '42P01')
    return 'projects テーブルが存在しません。supabase-setup.sql を Supabase の SQL エディタで実行してください。';
  if (code === '42501' || lower.includes('permission denied') || lower.includes('violates row-level security'))
    return '権限エラーで保存できませんでした（RLS ポリシー違反）。ログイン状態と Supabase の RLS ポリシーを確認してください。';
  if (code === '23502')
    return 'DBのカラム構成が一致していません（NOT NULL 制約違反）。';
  if (code === '23505')
    return 'すでに同じデータが存在します（一意制約違反）。';
  if (code === 'PGRST301' || lower.includes('jwt expired'))
    return 'セッションが期限切れです。再ログインしてください。';
  if (lower.includes('ログイン') || lower.includes('not authenticated') || lower.includes('jwt'))
    return 'ログインが必要です。再度ログインしてください。';
  if (lower.includes('failed to fetch'))
    return 'ネットワークエラーが発生しました。接続を確認してください。';

  // コード・詳細がある場合は付記
  const extra = [code && `コード: ${code}`, hint && `ヒント: ${hint}`].filter(Boolean).join(' / ');
  return `保存に失敗しました: ${msg}${extra ? ` (${extra})` : ''}`;
}

const VALID_STATUSES: ProjectStatus[] = ['planning', 'active', 'adjusting', 'done', 'paused'];

function arrayToText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean).join('\n');
  if (typeof value === 'string') return value;
  return '';
}

function parseTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const now = new Date().toISOString();
    if (typeof item === 'string') {
      return { id: crypto.randomUUID(), title: item, completed: false, priority: 'medium' as const, createdAt: now };
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
        title: typeof o.title === 'string' ? o.title : String(o.title ?? ''),
        completed: Boolean(o.completed),
        priority: (['high', 'medium', 'low'] as const).includes(o.priority as 'high') ? o.priority as Todo['priority'] : 'medium',
        dueDate: typeof o.dueDate === 'string' ? o.dueDate : null,
        note: typeof o.note === 'string' ? o.note : undefined,
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
      };
    }
    return { id: crypto.randomUUID(), title: String(item), completed: false, priority: 'medium' as const, createdAt: now };
  }).filter((t) => t.title.trim() !== '');
}

// JSON → FormData に変換。不正なら例外を投げる
function parseProjectJson(raw: string): Partial<FormData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON形式が正しくありません');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON形式が正しくありません');
  }
  const o = parsed as Record<string, unknown>;
  const result: Partial<FormData> = {};

  if (typeof o.title === 'string') result.title = o.title;
  if (typeof o.status === 'string' && VALID_STATUSES.includes(o.status as ProjectStatus))
    result.status = o.status as ProjectStatus;
  if (typeof o.url === 'string') result.url = o.url;
  if (typeof o.summary === 'string') result.summary = o.summary;
  if (o.targetUsers !== undefined) result.target = arrayToText(o.targetUsers);
  if (o.problem !== undefined) result.problem = arrayToText(o.problem);
  if (o.mvp !== undefined) result.mvpFeatures = arrayToText(o.mvp);
  if (o.future !== undefined) result.futureFeatures = arrayToText(o.future);
  if (o.tech !== undefined) result.techStack = arrayToText(o.tech);
  if (o.design !== undefined) result.designPolicy = arrayToText(o.design);
  if (typeof o.memo === 'string') result.memo = o.memo;
  if (o.todo !== undefined) result.todos = parseTodos(o.todo);

  return result;
}

export function ProjectForm({ initialData, onSubmit }: ProjectFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    title: initialData?.title ?? '',
    summary: initialData?.summary ?? '',
    target: initialData?.target ?? '',
    problem: initialData?.problem ?? '',
    mvpFeatures: initialData?.mvpFeatures ?? '',
    futureFeatures: initialData?.futureFeatures ?? '',
    techStack: initialData?.techStack ?? '',
    designPolicy: initialData?.designPolicy ?? '',
    memo: initialData?.memo ?? '',
    status: initialData?.status ?? 'planning',
    todos: initialData?.todos ?? [],
    nextAction: initialData?.nextAction ?? '',
    url: initialData?.url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveErrorDetail, setSaveErrorDetail] = useState<{ code?: string; details?: string; hint?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  // JSON インポートモーダル
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleLoadJson = () => {
    setJsonError('');
    try {
      const patch = parseProjectJson(jsonInput);
      setForm((prev) => ({ ...prev, ...patch }));
      setJsonModalOpen(false);
      setJsonInput('');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON形式が正しくありません');
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setJsonError('');
    } catch {
      setJsonError('JSON形式が正しくありません');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveErrorDetail(null);
    setSaved(false);

    if (!form.title.trim()) {
      setSaveError('入力内容を確認してください（案件名は必須です）');
      console.warn('[ProjectForm] validation failed: title empty');
      return;
    }

    // URL が入力済みで http/https 以外なら https:// を補完
    const normalizedUrl = form.url?.trim()
      ? form.url.trim().match(/^https?:\/\//) ? form.url.trim() : `https://${form.url.trim()}`
      : '';

    setSaving(true);
    console.log('[ProjectForm] submit started');
    console.log('[ProjectForm] payload:', JSON.stringify({ ...form, url: normalizedUrl }, null, 2));

    try {
      await onSubmit({ ...form, url: normalizedUrl });
      console.log('[ProjectForm] save success');
      setSaved(true);
    } catch (err) {
      console.error('[ProjectForm] submit failed:', err);
      setSaveError(toUserMessage(err));
      if (isSupabaseErrorLike(err)) {
        setSaveErrorDetail({ code: err.code, details: err.details, hint: err.hint });
      }
    } finally {
      setSaving(false);
    }
  };

  const buttonLabel = saving ? '保存中...' : saved ? '保存完了' : '保存する';

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* JSON インポート + 案件生成プロンプト導線 */}
      {!initialData && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link
            href="/prompts?category=案件生成"
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-400 transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            案件生成プロンプトを見る
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-gray-200 h-8 text-xs gap-1.5"
            onClick={() => { setJsonModalOpen(true); setJsonError(''); setJsonInput(''); }}
          >
            <FileJson className="w-3.5 h-3.5" />
            JSONから作成
          </Button>
        </div>
      )}

      {/* 案件名 / ステータス */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs">案件名 *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="例: ECサイトリニューアル"
            className="bg-gray-800 border-gray-700 h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs">ステータス</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v as ProjectStatus)}>
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 h-9 text-sm text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 次のアクション */}
      <div className="space-y-1.5">
        <Label htmlFor="nextAction" className="text-xs">次のアクション</Label>
        <Input
          id="nextAction"
          value={form.nextAction ?? ''}
          onChange={(e) => set('nextAction', e.target.value)}
          placeholder="例: デザインレビューを依頼する"
          className="bg-gray-800 border-gray-700 h-9 text-sm"
        />
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <Label htmlFor="url" className="text-xs">URL</Label>
        <Input
          id="url"
          type="url"
          value={form.url ?? ''}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://example.com"
          className="bg-gray-800 border-gray-700 h-9 text-sm"
        />
      </div>

      {/* 概要 */}
      <div className="space-y-1.5">
        <Label htmlFor="summary" className="text-xs">概要</Label>
        <Textarea id="summary" value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={3} placeholder="案件の概要を入力..." className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target" className="text-xs">対象ユーザー</Label>
        <Textarea id="target" value={form.target} onChange={(e) => set('target', e.target.value)} rows={2} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="problem" className="text-xs">解決したい課題</Label>
        <Textarea id="problem" value={form.problem} onChange={(e) => set('problem', e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mvpFeatures" className="text-xs">MVP機能</Label>
        <Textarea id="mvpFeatures" value={form.mvpFeatures} onChange={(e) => set('mvpFeatures', e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="futureFeatures" className="text-xs">将来機能</Label>
        <Textarea id="futureFeatures" value={form.futureFeatures} onChange={(e) => set('futureFeatures', e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="techStack" className="text-xs">技術スタック</Label>
        <Input id="techStack" value={form.techStack} onChange={(e) => set('techStack', e.target.value)} placeholder="例: Next.js, TypeScript, Supabase" className="bg-gray-800 border-gray-700 h-9 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="designPolicy" className="text-xs">デザイン方針</Label>
        <Textarea id="designPolicy" value={form.designPolicy} onChange={(e) => set('designPolicy', e.target.value)} rows={2} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memo" className="text-xs">メモ</Label>
        <Textarea id="memo" value={form.memo} onChange={(e) => set('memo', e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-sm" />
      </div>

      {saveError && (
        <div className="text-red-400 text-sm rounded-lg bg-red-950/50 border border-red-800/60 px-3 py-2 space-y-1">
          <p>{saveError}</p>
          {saveErrorDetail && (saveErrorDetail.code || saveErrorDetail.details || saveErrorDetail.hint) && (
            <ul className="text-xs text-red-300/80 list-none space-y-0.5 mt-1 border-t border-red-800/40 pt-1">
              {saveErrorDetail.code && <li>コード: {saveErrorDetail.code}</li>}
              {saveErrorDetail.details && <li>詳細: {saveErrorDetail.details}</li>}
              {saveErrorDetail.hint && <li>ヒント: {saveErrorDetail.hint}</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 h-9 min-w-[96px]"
        >
          {buttonLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800 h-9"
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
      </div>
    </form>

    {/* JSON インポートモーダル */}
    <Dialog open={jsonModalOpen} onOpenChange={(open) => { setJsonModalOpen(open); if (!open) setJsonError(''); }}>
      {/*
        flex flex-col: grid → flex に変換してヘッダー / ボディ / フッターを縦に並べる
        max-h-[88dvh]: dvh = dynamic viewport height（iPhone Safari のアドレスバーを考慮）
        overflow-hidden: 子要素がはみ出さないよう制御
      */}
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 w-[92vw] max-w-lg flex flex-col max-h-[88dvh] overflow-hidden">

        {/* ── ヘッダー（固定） ── */}
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <FileJson className="w-4 h-4 text-blue-400" />
            JSONから作成
          </DialogTitle>
          <p className="text-xs text-gray-500 font-normal">
            ChatGPT / Claude で生成した JSON を貼り付けてください。
          </p>
        </DialogHeader>

        {/* ── スクロール可能なボディ ── */}
        {/*
          flex-1: 残り高さをすべて取る
          overflow-y-auto: コンテンツが溢れたらスクロール
          min-h-0: flex 子要素がデフォルトで min-h: auto になるバグを回避
        */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          <Textarea
            value={jsonInput}
            onChange={(e) => { setJsonInput(e.target.value); setJsonError(''); }}
            placeholder={'{\n  "title": "案件名",\n  "summary": "概要",\n  "mvp": ["機能A", "機能B"],\n  "todo": ["タスク1"]\n}'}
            className={[
              'bg-gray-800 border-gray-700 text-gray-100 text-xs font-mono',
              'min-h-[200px] max-h-[40vh]', // 高さを固定範囲に収める
              'resize-none',                  // 手動リサイズ無効（無限伸びを防ぐ）
              'overflow-y-auto',              // 入力欄内でスクロール
            ].join(' ')}
          />

          {/* 文字数 + 整形ボタン */}
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] text-gray-600">
              {jsonInput.length > 0 ? `${jsonInput.length} 文字` : ''}
            </span>
            {jsonInput.trim() && (
              <button
                type="button"
                onClick={handleFormatJson}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline-offset-2 hover:underline"
              >
                JSONを整形
              </button>
            )}
          </div>

          {jsonError && (
            <p className="text-red-400 text-xs px-0.5">{jsonError}</p>
          )}
        </div>

        {/* ── フッター（常時表示） ── */}
        {/*
          shrink-0: 高さが圧縮されない
          -mx-4 -mb-4: DialogContent の p-4 を打ち消して端まで広げる
          border-t: ボディとの視覚的区切り
          flex-col: iPhone 縦では縦積み（full width タップ）
          sm:flex-row: デスクトップでは横並び右寄せ
        */}
        <div className="shrink-0 -mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t border-gray-700/70 bg-gray-900 px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 h-10 w-full sm:w-auto sm:h-9 text-sm"
            onClick={() => setJsonModalOpen(false)}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            disabled={!jsonInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 h-10 w-full sm:w-auto sm:h-9 text-sm"
            onClick={handleLoadJson}
          >
            読み込む
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
