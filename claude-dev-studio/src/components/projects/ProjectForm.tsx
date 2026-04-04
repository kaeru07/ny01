'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProjectStatus } from '@/types';
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
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveErrorDetail, setSaveErrorDetail] = useState<{ code?: string; details?: string; hint?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

    setSaving(true);
    console.log('[ProjectForm] submit started');
    console.log('[ProjectForm] payload:', JSON.stringify(form, null, 2));

    try {
      await onSubmit(form);
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
  );
}
