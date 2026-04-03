'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import { Project, DevNote, Prompt, PromptCategory, AICOMPANYRole, ProjectPhase } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { devNoteRepository } from '@/lib/repository/devNoteRepository';
import { promptRepository } from '@/lib/repository/promptRepository';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { PromptFormDialog } from '@/components/prompts/PromptFormDialog';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, Copy, Plus, ChevronRight, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { phaseLabel, phaseColor, roleLabel, roleColor } from '@/app/page';

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

const allPhases = Object.keys(phaseLabel) as ProjectPhase[];
const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

// 担当別メモのフィールドマッピング
type RoleNoteField =
  | 'secretaryNotes'
  | 'researcherNotes'
  | 'architectNotes'
  | 'uiDesignerNotes'
  | 'coderNotes'
  | 'reviewerNotes'
  | 'deployerNotes';

const roleNoteField: Record<AICOMPANYRole, RoleNoteField> = {
  secretary: 'secretaryNotes',
  researcher: 'researcherNotes',
  architect: 'architectNotes',
  ui_designer: 'uiDesignerNotes',
  coder: 'coderNotes',
  reviewer: 'reviewerNotes',
  deployer: 'deployerNotes',
};

type PromptFilterTab = 'all' | PromptCategory;
const promptFilterTabs: { value: PromptFilterTab; label: string }[] = [
  { value: 'all', label: '全て' },
  { value: 'new', label: '新規開発' },
  { value: 'fix', label: '改修用' },
  { value: 'ui', label: 'UI改善' },
  { value: 'debug', label: 'デバッグ' },
];

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="py-2.5 border-b border-gray-700 last:border-0">
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-100 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

interface QuickUpdateState {
  currentPhase: ProjectPhase | '';
  currentOwner: AICOMPANYRole | '';
  nextOwner: AICOMPANYRole | '';
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [devNote, setDevNote] = useState<DevNote | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  // Phase/owner quick update
  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  const [quickUpdate, setQuickUpdate] = useState<QuickUpdateState>({ currentPhase: '', currentOwner: '', nextOwner: '' });

  // Role note editing
  const [editingRole, setEditingRole] = useState<AICOMPANYRole | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  // Project delete
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);

  // Prompt management
  const [promptFilter, setPromptFilter] = useState<PromptFilterTab>('all');
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [deletePromptTarget, setDeletePromptTarget] = useState<Prompt | null>(null);

  const loadData = () => {
    const p = projectRepository.findById(id);
    if (!p) { router.push('/projects'); return; }
    setProject(p);
    setDevNote(devNoteRepository.findByProjectId(id));
    setPrompts(promptRepository.findByProjectId(id));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDeleteProject = () => {
    projectRepository.delete(id);
    toast.success('案件を削除しました');
    router.push('/projects');
  };

  const openPhaseDialog = () => {
    if (!project) return;
    setQuickUpdate({
      currentPhase: project.currentPhase ?? '',
      currentOwner: project.currentOwner ?? '',
      nextOwner: project.nextOwner ?? '',
    });
    setShowPhaseDialog(true);
  };

  const savePhaseUpdate = () => {
    projectRepository.update(id, {
      currentPhase: quickUpdate.currentPhase || undefined,
      currentOwner: quickUpdate.currentOwner || undefined,
      nextOwner: quickUpdate.nextOwner,
    });
    toast.success('進行状況を更新しました');
    setShowPhaseDialog(false);
    loadData();
  };

  const startEditRoleNote = (role: AICOMPANYRole) => {
    if (!project) return;
    setEditingRole(role);
    setEditingNoteValue(project[roleNoteField[role]] ?? '');
  };

  const saveRoleNote = () => {
    if (!editingRole) return;
    projectRepository.update(id, { [roleNoteField[editingRole]]: editingNoteValue });
    toast.success('メモを保存しました');
    setEditingRole(null);
    loadData();
  };

  const handleSavePrompt = (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingPrompt) {
      promptRepository.update(editingPrompt.id, data);
      toast.success('プロンプトを更新しました');
    } else {
      promptRepository.create(data);
      toast.success('プロンプトを追加しました');
    }
    setPromptDialogOpen(false);
    setEditingPrompt(undefined);
    setPrompts(promptRepository.findByProjectId(id));
  };

  const handleDeletePrompt = () => {
    if (!deletePromptTarget) return;
    promptRepository.delete(deletePromptTarget.id);
    toast.success('プロンプトを削除しました');
    setDeletePromptTarget(null);
    setPrompts(promptRepository.findByProjectId(id));
  };

  const filteredPrompts = prompts
    .filter((p) => promptFilter === 'all' || p.category === promptFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!project) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/projects" className="hover:text-white transition-colors">案件管理</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-300">{project.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">{project.title}</h1>
          {/* AICOMPANY進行バー */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.currentPhase ? (
              <Badge className={cn('text-xs', phaseColor[project.currentPhase])}>
                {phaseLabel[project.currentPhase]}
              </Badge>
            ) : (
              <Badge className="text-xs bg-gray-700 text-gray-400">工程未設定</Badge>
            )}
            {project.currentOwner ? (
              <Badge className={cn('text-xs', roleColor[project.currentOwner])}>
                担当: {roleLabel[project.currentOwner]}
              </Badge>
            ) : (
              <Badge className="text-xs bg-gray-700 text-gray-400">担当未設定</Badge>
            )}
            {project.nextOwner && (
              <>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <Badge className={cn('text-xs opacity-80', roleColor[project.nextOwner as AICOMPANYRole])}>
                  次: {roleLabel[project.nextOwner as AICOMPANYRole]}
                </Badge>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-gray-700 text-gray-400 hover:bg-gray-700 h-6 text-xs px-2"
              onClick={openPhaseDialog}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              更新
            </Button>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-8 text-xs" onClick={() => router.push(`/projects/${id}/edit`)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            編集
          </Button>
          <Button variant="outline" size="sm" className="border-red-900 text-red-400 hover:bg-red-900/30 h-8 text-xs" onClick={() => setShowDeleteProjectDialog(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            削除
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-800 border border-gray-700 flex-wrap h-auto gap-0">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">概要</TabsTrigger>
          {allRoles.map((role) => {
            const noteField = roleNoteField[role];
            const hasNote = !!(project[noteField]);
            const isCurrent = project.currentOwner === role;
            return (
              <TabsTrigger key={role} value={role} className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs relative">
                {roleLabel[role]}
                {isCurrent && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                {!hasNote && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="prompts" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">
            プロンプト {prompts.length > 0 && <span className="ml-1 text-[10px] text-gray-500">({prompts.length})</span>}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-5">
              <dl>
                <FieldRow label="概要" value={project.summary} />
                <FieldRow label="対象ユーザー" value={project.target} />
                <FieldRow label="解決したい課題" value={project.problem} />
                <FieldRow label="MVP機能" value={project.mvpFeatures} />
                <FieldRow label="将来機能" value={project.futureFeatures} />
                <FieldRow label="技術スタック" value={project.techStack} />
                <FieldRow label="デザイン方針" value={project.designPolicy} />
                <FieldRow label="メモ" value={project.memo} />
                <div className="py-2.5 border-b border-gray-700">
                  <dt className="text-xs text-gray-500 mb-0.5">作成日</dt>
                  <dd className="text-sm text-gray-100">{project.createdAt.slice(0, 10)}</dd>
                </div>
                <div className="py-2.5">
                  <dt className="text-xs text-gray-500 mb-0.5">最終更新</dt>
                  <dd className="text-sm text-gray-100">{project.updatedAt.slice(0, 10)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Note Tabs */}
        {allRoles.map((role) => {
          const noteField = roleNoteField[role];
          const noteValue = project[noteField] ?? '';
          const isCurrent = project.currentOwner === role;
          const isNext = project.nextOwner === role;
          return (
            <TabsContent key={role} value={role} className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm text-gray-200">{roleLabel[role]} メモ</CardTitle>
                    {isCurrent && <Badge className="text-[10px] px-1.5 py-0 bg-blue-700 text-white">現在担当</Badge>}
                    {isNext && <Badge className="text-[10px] px-1.5 py-0 bg-gray-600 text-white">次担当</Badge>}
                  </div>
                  {editingRole !== role && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs"
                      onClick={() => startEditRoleNote(role)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      編集
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {editingRole === role ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingNoteValue}
                        onChange={(e) => setEditingNoteValue(e.target.value)}
                        rows={8}
                        placeholder={`${roleLabel[role]}の作業メモを入力...`}
                        className="bg-gray-700 border-gray-600 text-gray-100 text-sm resize-y"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={saveRoleNote}>保存</Button>
                        <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs" onClick={() => setEditingRole(null)}>キャンセル</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-300 whitespace-pre-wrap min-h-[4rem]">
                      {noteValue || <span className="text-gray-600 italic">未記入</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {promptFilterTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setPromptFilter(tab.value)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                      promptFilter === tab.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                onClick={() => { setEditingPrompt(undefined); setPromptDialogOpen(true); }}
              >
                <Plus className="w-3 h-3 mr-1" />
                追加
              </Button>
            </div>

            {filteredPrompts.length === 0 && (
              <p className="text-gray-500 text-sm py-4">プロンプトがありません</p>
            )}

            {filteredPrompts.map((pr) => (
              <Card key={pr.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge className={cn('text-xs', categoryColor[pr.category])}>
                          {categoryLabel[pr.category]}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                          {pr.version}
                        </Badge>
                        {pr.targetRole && (
                          <Badge className={cn('text-xs', roleColor[pr.targetRole as AICOMPANYRole])}>
                            {roleLabel[pr.targetRole as AICOMPANYRole]}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">{pr.updatedAt.slice(0, 10)}</span>
                      </div>
                      <h3 className="text-white text-sm font-medium mb-1">{pr.title}</h3>
                      {pr.changeMemo && (
                        <p className="text-xs text-gray-500 mb-1.5">{pr.changeMemo}</p>
                      )}
                      <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap font-mono">
                        {pr.body}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs" onClick={() => navigator.clipboard.writeText(pr.body).then(() => toast.success('コピーしました'))}>
                        <Copy className="w-3 h-3 mr-1" />
                        コピー
                      </Button>
                      <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs" onClick={() => { setEditingPrompt(pr); setPromptDialogOpen(true); }}>
                        <Pencil className="w-3 h-3 mr-1" />
                        編集
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/30 h-7 text-xs" onClick={() => setDeletePromptTarget(pr)}>
                        <Trash2 className="w-3 h-3 mr-1" />
                        削除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Phase/Owner Quick Update Dialog */}
      <Dialog open={showPhaseDialog} onOpenChange={setShowPhaseDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">進行状況を更新</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">現在の工程</Label>
              <Select
                value={quickUpdate.currentPhase}
                onValueChange={(v) => setQuickUpdate((s) => ({ ...s, currentPhase: v as ProjectPhase }))}
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
                onValueChange={(v) => setQuickUpdate((s) => ({ ...s, currentOwner: v as AICOMPANYRole }))}
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
                onValueChange={(v) => setQuickUpdate((s) => ({ ...s, nextOwner: v as AICOMPANYRole }))}
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
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs" onClick={() => setShowPhaseDialog(false)}>キャンセル</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 h-8 text-xs" onClick={savePhaseUpdate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={showDeleteProjectDialog} onOpenChange={setShowDeleteProjectDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
          <DialogHeader><DialogTitle>案件を削除しますか？</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">「{project.title}」を削除します。この操作は元に戻せません。</p>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setShowDeleteProjectDialog(false)}>キャンセル</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteProject}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Prompt Dialog */}
      <Dialog open={!!deletePromptTarget} onOpenChange={(open) => !open && setDeletePromptTarget(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
          <DialogHeader><DialogTitle>プロンプトを削除しますか？</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">「{deletePromptTarget?.title}」を削除します。</p>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" onClick={() => setDeletePromptTarget(null)}>キャンセル</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeletePrompt}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptFormDialog
        projectId={id}
        initialData={editingPrompt}
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
        onSave={handleSavePrompt}
      />
    </div>
  );
}
