'use client';

import { useEffect, useState, useRef } from 'react';
import { TemplatePrompt } from '@/types';
import { templatePromptRepository } from '@/lib/repository/templatePromptRepository';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { Plus, Copy, Pencil, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

// 初期サンプルプロンプト
const SAMPLE_PROMPT: Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'チャットから案件生成',
  category: '案件生成',
  description: '既存チャットから案件JSONを生成する',
  content: `このチャットの内容から、新しい開発案件として整理してください。

以下のルールでJSON形式で出力してください。

# ルール

- 必ずJSONのみ出力
- 説明文は不要
- 不明な項目は空文字または空配列

# JSON形式

{
  "title": "",
  "status": "planning",
  "url": "",
  "summary": "",
  "targetUsers": "",
  "problem": "",
  "mvp": [],
  "future": [],
  "tech": "",
  "design": "",
  "memo": "",
  "todo": []
}

# 抽出ルール

title:
- このチャットの開発内容の名前

summary:
- このアプリの概要

targetUsers:
- 想定ユーザー

problem:
- 解決したい課題

mvp:
- 最小機能を配列で

future:
- 将来機能

tech:
- 使用技術（推定OK）

design:
- UI方針（推定OK）

memo:
- 補足

todo:
- このチャットで出てきた作業タスク

todo形式:

{
  "title": "",
  "priority": "medium"
}

priority:
- high
- medium
- low

このチャット全体を分析して生成してください。`,
  tags: '案件, 生成, JSON, ChatGPT',
};

// カテゴリカラー（動的カテゴリ用）
const CATEGORY_COLORS = [
  'bg-blue-700 text-white',
  'bg-purple-700 text-white',
  'bg-green-700 text-white',
  'bg-orange-700 text-white',
  'bg-pink-700 text-white',
  'bg-teal-700 text-white',
  'bg-yellow-700 text-white',
  'bg-red-700 text-white',
];

const CATEGORY_SUGGESTIONS = ['案件生成', 'ToDo生成', '改修', '設計', '調査', 'その他'];

function getCategoryColor(category: string, allCategories: string[]): string {
  const idx = allCategories.indexOf(category);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0];
}

// ---- Form Dialog ----

type FormData = Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: FormData = { name: '', category: '', description: '', content: '', tags: '' };

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TemplatePrompt | null;
  onSave: (data: FormData) => Promise<void>;
}

function PromptFormDialog({ open, onOpenChange, initialData, onSave }: FormDialogProps) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initialData
        ? { name: initialData.name, category: initialData.category, description: initialData.description, content: initialData.content, tags: initialData.tags }
        : EMPTY_FORM
      );
    }
  }, [open, initialData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const loadSample = () => {
    setForm({
      name: SAMPLE_PROMPT.name,
      category: SAMPLE_PROMPT.category,
      description: SAMPLE_PROMPT.description,
      content: SAMPLE_PROMPT.content,
      tags: SAMPLE_PROMPT.tags,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialData ? 'プロンプトを編集' : '新規プロンプト'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* サンプル読み込みボタン（新規時のみ） */}
          {!initialData && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white text-xs h-7"
                onClick={loadSample}
              >
                サンプルを読み込む
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pname" className="text-xs text-gray-400">名前 *</Label>
            <Input
              id="pname"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="例: チャットから案件生成"
              className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5 relative" ref={suggestRef}>
            <Label htmlFor="pcategory" className="text-xs text-gray-400">カテゴリ *</Label>
            <Input
              id="pcategory"
              value={form.category}
              onChange={(e) => { set('category', e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              required
              placeholder="例: 案件生成"
              className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
              autoComplete="off"
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-700 rounded mt-1 overflow-hidden shadow-lg">
                {CATEGORY_SUGGESTIONS.filter((s) =>
                  !form.category || s.toLowerCase().includes(form.category.toLowerCase())
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    onClick={() => { set('category', s); setShowSuggestions(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdesc" className="text-xs text-gray-400">説明</Label>
            <Textarea
              id="pdesc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="このプロンプトの用途・説明"
              className="bg-gray-800 border-gray-700 text-white text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pcontent" className="text-xs text-gray-400">プロンプト本文 *</Label>
            <Textarea
              id="pcontent"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              required
              rows={14}
              placeholder="プロンプトの内容..."
              className="bg-gray-800 border-gray-700 text-white font-mono text-xs leading-relaxed resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ptags" className="text-xs text-gray-400">タグ（カンマ区切り）</Label>
            <Input
              id="ptags"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="例: 案件, 生成, JSON"
              className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 h-9 text-sm"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm"
            >
              {saving ? '保存中...' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Prompt Card ----

interface PromptCardProps {
  prompt: TemplatePrompt;
  categoryColor: string;
  onEdit: () => void;
  onDelete: () => void;
}

function PromptCard({ prompt, categoryColor, onEdit, onDelete }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    toast.success('コピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const tagList = prompt.tags
    ? prompt.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const lines = prompt.content.split('\n');
  const isLong = lines.length > 4 || prompt.content.length > 200;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={cn('text-xs px-2 py-0.5', categoryColor)}>
                {prompt.category}
              </Badge>
              {tagList.map((tag) => (
                <span key={tag} className="text-xs text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
              <span className="text-xs text-gray-600 ml-auto">
                {(prompt.updatedAt ?? prompt.createdAt ?? '').slice(0, 10)}
              </span>
            </div>

            {/* Name */}
            <h3 className="text-white font-semibold text-sm mb-1">{prompt.name}</h3>

            {/* Description */}
            {prompt.description && (
              <p className="text-xs text-gray-500 mb-2">{prompt.description}</p>
            )}

            {/* Content preview */}
            <div
              className={cn(
                'text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900/60 rounded p-2.5 cursor-pointer',
                !expanded && 'line-clamp-4'
              )}
              onClick={() => isLong && setExpanded(!expanded)}
            >
              {prompt.content}
            </div>
            {isLong && (
              <button
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded
                  ? <><ChevronUp className="w-3 h-3" />折りたたむ</>
                  : <><ChevronDown className="w-3 h-3" />全文を表示</>
                }
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              size="sm"
              className={cn(
                'h-8 text-xs w-20 font-medium transition-colors',
                copied
                  ? 'bg-green-600 hover:bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
              onClick={handleCopy}
            >
              {copied
                ? <><Check className="w-3 h-3 mr-1" />コピー済</>
                : <><Copy className="w-3 h-3 mr-1" />コピー</>
              }
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs w-20"
              onClick={onEdit}
            >
              <Pencil className="w-3 h-3 mr-1" />
              編集
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-900 text-red-400 hover:bg-red-900/30 h-8 text-xs w-20"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              削除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main Page ----

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<TemplatePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplatePrompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplatePrompt | null>(null);

  const load = async () => {
    try {
      const data = await templatePromptRepository.findAll();
      setPrompts(data);
    } catch (e) {
      console.error(e);
      toast.error('読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allCategories = [...new Set(prompts.map((p) => p.category).filter(Boolean))];

  const filtered = categoryFilter === 'all'
    ? prompts
    : prompts.filter((p) => p.category === categoryFilter);

  const handleSave = async (data: Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editTarget) {
      await templatePromptRepository.update(editTarget.id, data);
      toast.success('更新しました');
    } else {
      await templatePromptRepository.create(data);
      toast.success('保存しました');
    }
    setEditTarget(null);
    await load();
  };

  const handleEdit = (prompt: TemplatePrompt) => {
    setEditTarget(prompt);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await templatePromptRepository.delete(deleteTarget.id);
    toast.success('削除しました');
    setDeleteTarget(null);
    await load();
  };

  const handleAddSample = async () => {
    await templatePromptRepository.create(SAMPLE_PROMPT);
    toast.success('サンプルを登録しました');
    await load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">プロンプト管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">AI作業テンプレート置き場</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm shrink-0"
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-1" />
          新規プロンプト
        </Button>
      </div>

      {/* Category filter */}
      {allCategories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              categoryFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            )}
          >
            すべて ({prompts.length})
          </button>
          {allCategories.map((cat) => {
            const count = prompts.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">読み込み中...</p>
      ) : prompts.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-4">
          <p className="text-gray-500 text-sm">プロンプトがまだありません</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 text-sm h-9"
              onClick={handleAddSample}
            >
              サンプルを登録する
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9"
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-1" />
              新規作成
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          このカテゴリにはプロンプトがありません
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              categoryColor={getCategoryColor(prompt.category, allCategories)}
              onEdit={() => handleEdit(prompt)}
              onDelete={() => setDeleteTarget(prompt)}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <PromptFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditTarget(null); }}
        initialData={editTarget}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-sm">
          <DialogHeader>
            <DialogTitle>プロンプトを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">
            「{deleteTarget?.name}」を削除します。この操作は取り消せません。
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => setDeleteTarget(null)}
            >
              キャンセル
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConfirm}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
