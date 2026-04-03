'use client';

import { useState, useEffect } from 'react';
import { Prompt, PromptCategory, AICOMPANYRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { roleLabel } from '@/app/page';

const categoryOptions: { value: PromptCategory; label: string }[] = [
  { value: 'new', label: '新規開発' },
  { value: 'fix', label: '改修用' },
  { value: 'ui', label: 'UI改善' },
  { value: 'debug', label: 'デバッグ' },
];

const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

type FormData = Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>;

interface PromptFormDialogProps {
  projectId: string;
  initialData?: Prompt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: FormData) => void;
}

export function PromptFormDialog({ projectId, initialData, open, onOpenChange, onSave }: PromptFormDialogProps) {
  const [form, setForm] = useState<FormData>({
    projectId,
    category: initialData?.category ?? 'new',
    version: initialData?.version ?? 'v1',
    title: initialData?.title ?? '',
    body: initialData?.body ?? '',
    changeMemo: initialData?.changeMemo ?? '',
    targetRole: initialData?.targetRole ?? '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        projectId,
        category: initialData?.category ?? 'new',
        version: initialData?.version ?? 'v1',
        title: initialData?.title ?? '',
        body: initialData?.body ?? '',
        changeMemo: initialData?.changeMemo ?? '',
        targetRole: initialData?.targetRole ?? '',
      });
    }
  }, [open, initialData, projectId]);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 text-gray-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'プロンプトを編集' : 'プロンプトを追加'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">カテゴリ</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v as PromptCategory)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {categoryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">対象担当</Label>
              <Select value={form.targetRole ?? ''} onValueChange={(v) => set('targetRole', v ?? '')}>
                <SelectTrigger className="bg-gray-700 border-gray-600 h-8 text-sm">
                  <SelectValue placeholder="担当を選択" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="">指定なし</SelectItem>
                  {allRoles.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version" className="text-xs">バージョン</Label>
              <Input id="version" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="v1" className="bg-gray-700 border-gray-600 h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ptitle" className="text-xs">タイトル</Label>
            <Input id="ptitle" value={form.title} onChange={(e) => set('title', e.target.value)} required className="bg-gray-700 border-gray-600 h-8 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body" className="text-xs">プロンプト本文</Label>
            <Textarea id="body" value={form.body} onChange={(e) => set('body', e.target.value)} rows={10} required className="bg-gray-700 border-gray-600 font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="changeMemo" className="text-xs">変更メモ</Label>
            <Input id="changeMemo" value={form.changeMemo} onChange={(e) => set('changeMemo', e.target.value)} placeholder="例: 初版 / 出力形式を修正" className="bg-gray-700 border-gray-600 h-8 text-sm" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-sm" onClick={() => onOpenChange(false)}>キャンセル</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-8 text-sm">保存する</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
