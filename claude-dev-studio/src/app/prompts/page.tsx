'use client';

import { useEffect, useState } from 'react';
import { Prompt, PromptCategory, AICOMPANYRole } from '@/types';
import { promptRepository } from '@/lib/repository/promptRepository';
import { projectRepository } from '@/lib/repository/projectRepository';
import { Project } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Search, Copy, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { roleLabel, roleColor } from '@/app/page';

const categoryLabel: Record<PromptCategory, string> = {
  new: '新規開発',
  fix: '改修用',
  ui: 'UI改善',
  debug: 'デバッグ',
};

const categoryColor: Record<PromptCategory, string> = {
  new: 'bg-blue-700 text-white',
  fix: 'bg-orange-700 text-white',
  ui: 'bg-purple-700 text-white',
  debug: 'bg-red-700 text-white',
};

type FilterTab = 'all' | PromptCategory | AICOMPANYRole;

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PromptCategory>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | AICOMPANYRole>('all');
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const [prs, ps] = await Promise.all([
      promptRepository.findAll(),
      projectRepository.findAll(),
    ]);
    setPrompts(prs);
    setProjects(ps);
  };

  useEffect(() => { load(); }, []);

  const getProjectTitle = (pid: string) => projects.find((p) => p.id === pid)?.title ?? '—';

  const filtered = prompts
    .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
    .filter((p) => roleFilter === 'all' || p.targetRole === roleFilter)
    .filter((p) => search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await promptRepository.delete(deleteTarget.id);
    toast.success('削除しました');
    setDeleteTarget(null);
    load();
  };

  const allCategories: PromptCategory[] = ['new', 'fix', 'ui', 'debug'];
  const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">プロンプト管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">補助機能 — 各担当用プロンプトを一覧で管理</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">カテゴリ</span>
          <button onClick={() => setCategoryFilter('all')} className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}>全て</button>
          {allCategories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', categoryFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}>
              {categoryLabel[c]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12">担当</span>
          <button onClick={() => setRoleFilter('all')} className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', roleFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}>全て</button>
          {allRoles.map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', roleFilter === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}>
              {roleLabel[r]}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="タイトル・本文で検索..." className="pl-8 bg-gray-800 border-gray-700 h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm py-4">プロンプトがありません</p>
        )}
        {filtered.map((pr) => (
          <Card key={pr.id} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge className={cn('text-xs', categoryColor[pr.category])}>
                      {categoryLabel[pr.category]}
                    </Badge>
                    {pr.targetRole && (
                      <Badge className={cn('text-xs', roleColor[pr.targetRole as AICOMPANYRole])}>
                        {roleLabel[pr.targetRole as AICOMPANYRole]}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                      {pr.version}
                    </Badge>
                    <span className="text-xs text-gray-600">{getProjectTitle(pr.projectId)}</span>
                    <span className="text-xs text-gray-600">{pr.updatedAt.slice(0, 10)}</span>
                  </div>
                  <h3 className="text-white text-sm font-medium mb-1">{pr.title}</h3>
                  {pr.changeMemo && (
                    <p className="text-xs text-gray-500 mb-1.5">{pr.changeMemo}</p>
                  )}
                  <div
                    className={cn(
                      'text-xs text-gray-400 whitespace-pre-wrap font-mono cursor-pointer',
                      expanded !== pr.id && 'line-clamp-3'
                    )}
                    onClick={() => setExpanded(expanded === pr.id ? null : pr.id)}
                  >
                    {pr.body}
                  </div>
                  {pr.body.split('\n').length > 3 && (
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                      onClick={() => setExpanded(expanded === pr.id ? null : pr.id)}
                    >
                      {expanded === pr.id ? '折りたたむ' : '全文を表示'}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs" onClick={() => navigator.clipboard.writeText(pr.body).then(() => toast.success('コピーしました'))}>
                    <Copy className="w-3 h-3 mr-1" />
                    コピー
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/30 h-7 text-xs" onClick={() => setDeleteTarget(pr)}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    削除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
          <DialogHeader><DialogTitle>プロンプトを削除しますか？</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">「{deleteTarget?.title}」を削除します。</p>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
