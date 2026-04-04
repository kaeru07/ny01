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
  onSubmit: (data: FormData) => void;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: '未着手' },
  { value: 'active', label: '進行中' },
  { value: 'adjusting', label: '調整中' },
  { value: 'done', label: '完了' },
  { value: 'paused', label: '保留' },
];

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

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

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

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-9">保存する</Button>
        <Button type="button" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 h-9" onClick={() => router.back()}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
