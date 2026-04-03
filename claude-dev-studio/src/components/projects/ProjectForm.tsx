'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProjectStatus, ProjectPhase, AICOMPANYRole } from '@/types';
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
import { phaseLabel, roleLabel } from '@/app/page';

type FormData = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

interface ProjectFormProps {
  initialData?: Project;
  onSubmit: (data: FormData) => void;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: '計画中' },
  { value: 'active', label: '着手中' },
  { value: 'done', label: '完了' },
  { value: 'paused', label: '一時停止' },
];

const allPhases = Object.keys(phaseLabel) as ProjectPhase[];
const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

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
    currentPhase: initialData?.currentPhase,
    currentOwner: initialData?.currentOwner,
    nextOwner: initialData?.nextOwner ?? '',
    secretaryNotes: initialData?.secretaryNotes ?? '',
    researcherNotes: initialData?.researcherNotes ?? '',
    architectNotes: initialData?.architectNotes ?? '',
    uiDesignerNotes: initialData?.uiDesignerNotes ?? '',
    coderNotes: initialData?.coderNotes ?? '',
    reviewerNotes: initialData?.reviewerNotes ?? '',
    deployerNotes: initialData?.deployerNotes ?? '',
  });

  const set = (field: keyof FormData, value: string | undefined) =>
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

      {/* AICOMPANY進行管理 */}
      <div className="border border-gray-700 rounded-lg p-4 space-y-3">
        <p className="text-xs text-gray-400 font-medium">AICOMPANY 進行管理</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">現在の工程</Label>
            <Select
              value={form.currentPhase ?? ''}
              onValueChange={(v) => set('currentPhase', v || undefined)}
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 h-8 text-xs text-gray-100">
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">未設定</SelectItem>
                {allPhases.map((ph) => (
                  <SelectItem key={ph} value={ph}>{phaseLabel[ph]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">現在の担当</Label>
            <Select
              value={form.currentOwner ?? ''}
              onValueChange={(v) => set('currentOwner', v || undefined)}
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 h-8 text-xs text-gray-100">
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">未設定</SelectItem>
                {allRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">次の担当</Label>
            <Select
              value={form.nextOwner ?? ''}
              onValueChange={(v) => set('nextOwner', v || undefined)}
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 h-8 text-xs text-gray-100">
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">未設定</SelectItem>
                {allRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
