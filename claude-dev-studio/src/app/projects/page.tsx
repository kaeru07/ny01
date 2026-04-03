'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project, ProjectStatus, ProjectPhase, AICOMPANYRole } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, Eye, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { phaseLabel, phaseColor, roleLabel, roleColor } from '@/app/page';

const statusLabel: Record<ProjectStatus, string> = {
  planning: '計画中',
  active: '着手中',
  done: '完了',
  paused: '一時停止',
};

const statusColor: Record<ProjectStatus, string> = {
  active: 'bg-green-700 text-white',
  planning: 'bg-gray-600 text-white',
  done: 'bg-gray-700 text-white',
  paused: 'bg-yellow-700 text-white',
};

type FilterTab = 'all' | ProjectStatus;
const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: '全て' },
  { value: 'active', label: '着手中' },
  { value: 'planning', label: '計画中' },
  { value: 'done', label: '完了' },
  { value: 'paused', label: '停止中' },
];

const allPhases = Object.keys(phaseLabel) as ProjectPhase[];
const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

interface QuickUpdateState {
  project: Project;
  currentPhase: ProjectPhase | '';
  currentOwner: AICOMPANYRole | '';
  nextOwner: AICOMPANYRole | '';
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [quickUpdate, setQuickUpdate] = useState<QuickUpdateState | null>(null);

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

  const openQuickUpdate = (p: Project) => {
    setQuickUpdate({
      project: p,
      currentPhase: p.currentPhase ?? '',
      currentOwner: p.currentOwner ?? '',
      nextOwner: p.nextOwner ?? '',
    });
  };

  const handleQuickUpdate = () => {
    if (!quickUpdate) return;
    projectRepository.update(quickUpdate.project.id, {
      currentPhase: quickUpdate.currentPhase || undefined,
      currentOwner: quickUpdate.currentOwner || undefined,
      nextOwner: quickUpdate.nextOwner,
    });
    toast.success('進行状況を更新しました');
    setQuickUpdate(null);
    load();
  };

  return (
    <div className="p-6 space-y-5">
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
      <div className="flex items-center gap-3 flex-wrap">
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

      {/* Header row */}
      <div className="hidden md:grid grid-cols-[1fr_120px_110px_110px_90px_auto] gap-3 px-3 text-xs text-gray-500 font-medium">
        <span>案件名</span>
        <span>現在工程</span>
        <span>現在担当</span>
        <span>次担当</span>
        <span>更新日</span>
        <span />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm py-4">案件がありません</p>
        )}
        {filtered.map((p) => (
          <Card key={p.id} className="bg-gray-800 border-gray-700">
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_110px_110px_90px_auto] gap-2 items-center">
                {/* 案件名 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/projects/${p.id}`} className="text-white text-sm font-medium hover:text-blue-400 transition-colors truncate">
                      {p.title}
                    </Link>
                    <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', statusColor[p.status])}>
                      {statusLabel[p.status]}
                    </Badge>
                  </div>
                  {p.summary && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{p.summary}</p>
                  )}
                </div>

                {/* 現在工程 */}
                <div>
                  {p.currentPhase ? (
                    <Badge className={cn('text-[10px] px-1.5 py-0', phaseColor[p.currentPhase])}>
                      {phaseLabel[p.currentPhase]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>

                {/* 現在担当 */}
                <div>
                  {p.currentOwner ? (
                    <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.currentOwner])}>
                      {roleLabel[p.currentOwner]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>

                {/* 次担当 */}
                <div className="flex items-center gap-1">
                  {p.nextOwner ? (
                    <>
                      <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                      <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.nextOwner as AICOMPANYRole])}>
                        {roleLabel[p.nextOwner as AICOMPANYRole]}
                      </Badge>
                    </>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>

                {/* 更新日 */}
                <span className="text-xs text-gray-500">{p.updatedAt.slice(0, 10)}</span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2"
                    onClick={() => openQuickUpdate(p)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    更新
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    詳細
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs px-2"
                    onClick={() => router.push(`/projects/${p.id}/edit`)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-900 text-red-400 hover:bg-red-900/30 h-7 text-xs px-2"
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Update Dialog */}
      <Dialog open={!!quickUpdate} onOpenChange={(open) => !open && setQuickUpdate(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">進行状況を更新</DialogTitle>
          </DialogHeader>
          {quickUpdate && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-400 text-xs truncate">{quickUpdate.project.title}</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">現在の工程</Label>
                <Select
                  value={quickUpdate.currentPhase}
                  onValueChange={(v) => setQuickUpdate((s) => s && ({ ...s, currentPhase: v as ProjectPhase }))}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 h-8 text-sm">
                    <SelectValue placeholder="工程を選択" />
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
                <Label className="text-xs text-gray-400">現在の担当</Label>
                <Select
                  value={quickUpdate.currentOwner}
                  onValueChange={(v) => setQuickUpdate((s) => s && ({ ...s, currentOwner: v as AICOMPANYRole }))}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 h-8 text-sm">
                    <SelectValue placeholder="担当を選択" />
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
                <Label className="text-xs text-gray-400">次の担当</Label>
                <Select
                  value={quickUpdate.nextOwner}
                  onValueChange={(v) => setQuickUpdate((s) => s && ({ ...s, nextOwner: v as AICOMPANYRole }))}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 h-8 text-sm">
                    <SelectValue placeholder="次担当を選択" />
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
          )}
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs" onClick={() => setQuickUpdate(null)}>
              キャンセル
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 h-8 text-xs" onClick={handleQuickUpdate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
