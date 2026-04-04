'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project, ProjectStatus } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, Eye, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { calcProgress, ProgressBar, statusLabel, statusColor } from '@/app/page';

type FilterTab = 'all' | ProjectStatus;
const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: '全て' },
  { value: 'active', label: '進行中' },
  { value: 'planning', label: '未着手' },
  { value: 'adjusting', label: '調整中' },
  { value: 'done', label: '完了' },
  { value: 'paused', label: '保留' },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const load = () => setProjects(projectRepository.findAll());

  useEffect(() => { load(); }, []);

  const filtered = projects
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => search === '' || p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleDelete = () => {
    if (!deleteTarget) return;
    projectRepository.delete(deleteTarget.id);
    toast.success('案件を削除しました');
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">案件管理</h1>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新しい案件
        </Link>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                filter === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="案件名で検索..."
            className="pl-8 bg-gray-800 border-gray-700 h-8 text-sm w-52"
          />
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:grid grid-cols-[1fr_180px_80px_auto] gap-3 px-3 text-xs text-gray-500 font-medium">
        <span>案件名</span>
        <span>進捗</span>
        <span>状態</span>
        <span />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm py-4">案件がありません</p>
        )}
        {filtered.map((p) => {
          const pct = calcProgress(p.todos ?? []);
          const totalTodos = (p.todos ?? []).length;
          const doneTodos = (p.todos ?? []).filter((t) => t.completed).length;
          const pendingTodos = totalTodos - doneTodos;

          return (
            <Card key={p.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-3">
                {/* Mobile layout */}
                <div className="flex flex-col gap-2 md:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/projects/${p.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors truncate flex-1">
                      {p.title}
                    </Link>
                    <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', statusColor[p.status] ?? 'bg-gray-600 text-white')}>
                      {statusLabel[p.status] ?? p.status}
                    </Badge>
                  </div>
                  {p.summary && (
                    <p className="text-xs text-gray-500 truncate">{p.summary}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={pct} className="flex-1" />
                    <span className="text-xs font-medium text-white w-10 text-right">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        {doneTodos}/{totalTodos}
                      </span>
                      {pendingTodos > 0 && (
                        <span className="flex items-center gap-1">
                          <Circle className="w-3 h-3 text-orange-400" />
                          残{pendingTodos}件
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2" onClick={() => router.push(`/projects/${p.id}`)}>
                        <Eye className="w-3 h-3 mr-1" />
                        詳細
                      </Button>
                      <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2" onClick={() => router.push(`/projects/${p.id}/edit`)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/30 h-7 text-xs px-2" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[1fr_180px_80px_auto] gap-3 items-center">
                  {/* 案件名 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${p.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors truncate">
                        {p.title}
                      </Link>
                    </div>
                    {p.summary && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{p.summary}</p>
                    )}
                  </div>

                  {/* 進捗 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={pct} className="flex-1" />
                      <span className="text-xs font-medium text-white w-8 text-right">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>{doneTodos}/{totalTodos} 完了</span>
                      {pendingTodos > 0 && <span className="text-orange-400">残{pendingTodos}件</span>}
                    </div>
                  </div>

                  {/* 状態 */}
                  <div>
                    <Badge className={cn('text-[10px] px-1.5 py-0', statusColor[p.status] ?? 'bg-gray-600 text-white')}>
                      {statusLabel[p.status] ?? p.status}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2" onClick={() => router.push(`/projects/${p.id}`)}>
                      <Eye className="w-3 h-3 mr-1" />
                      詳細
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2" onClick={() => router.push(`/projects/${p.id}/edit`)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/30 h-7 text-xs px-2" onClick={() => setDeleteTarget(p)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>案件を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">
            「{deleteTarget?.title}」を削除します。この操作は元に戻せません。
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
