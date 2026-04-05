'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import { Project, Prompt, PromptCategory, AICOMPANYRole, Todo, TodoPriority } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { promptRepository } from '@/lib/repository/promptRepository';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { PromptFormDialog } from '@/components/prompts/PromptFormDialog';
import { TemplatePromptsPanel } from '@/components/prompts/TemplatePromptsPanel';
import { cn } from '@/lib/utils';
import {
  Pencil, Trash2, Copy, Plus, ChevronRight, CheckSquare, Square,
  ChevronDown, ChevronUp, CalendarDays, AlertCircle, ExternalLink, FileJson, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  calcProgress, ProgressBar, statusLabel, statusColor,
  roleLabel, roleColor, getTodayStr, getWeekEndStr, getDueDateStatus,
} from '@/app/page';

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

const priorityLabel: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const priorityColor: Record<TodoPriority, string> = {
  high: 'bg-red-700 text-white',
  medium: 'bg-yellow-700 text-white',
  low: 'bg-gray-600 text-white',
};

type SortOption = 'pending_first' | 'priority' | 'dueDate' | 'createdAt';
const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'pending_first', label: '未完了優先' },
  { value: 'dueDate', label: '期限順' },
  { value: 'priority', label: '優先度順' },
  { value: 'createdAt', label: '作成日順' },
];

const priorityOrder: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

function sortTodos(todos: Todo[], sortBy: SortOption): Todo[] {
  return [...todos].sort((a, b) => {
    if (sortBy === 'dueDate') {
      // 期限あり → 近い順、未設定は最後。完了済みは常に末尾。
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aDate = a.dueDate ?? '9999-12-31';
      const bDate = b.dueDate ?? '9999-12-31';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (sortBy === 'priority') {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (sortBy === 'createdAt') {
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    }
    // pending_first (default)
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

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

function DueDateBadge({ dueDate, completed }: { dueDate?: string | null; completed: boolean }) {
  const status = getDueDateStatus(dueDate, completed);
  if (!dueDate) return <span className="text-[10px] text-gray-600">期限: 未設定</span>;

  const colorMap = {
    overdue: 'text-red-400',
    today: 'text-yellow-400',
    upcoming: 'text-gray-500',
    none: 'text-gray-600',
  };
  const label = status === 'overdue' ? '期限切れ' : status === 'today' ? '今日' : '';

  return (
    <span className={cn('text-[10px] flex items-center gap-1', colorMap[status])}>
      {status === 'overdue' && <AlertCircle className="w-3 h-3" />}
      <CalendarDays className="w-3 h-3" />
      {dueDate}
      {label && <span className="font-medium">({label})</span>}
    </span>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);

  // Todo state
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>('medium');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('pending_first');
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; value: string } | null>(null);

  // Bulk add (JSON) state
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonLoading, setJsonLoading] = useState(false);

  // Prompt state
  const [promptFilter, setPromptFilter] = useState<PromptFilterTab>('all');
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [deletePromptTarget, setDeletePromptTarget] = useState<Prompt | null>(null);

  const loadData = async () => {
    console.log('[ProjectDetail] loadData start, id:', id);
    setLoadError(null);
    try {
      const [p, prs] = await Promise.all([
        projectRepository.findById(id),
        promptRepository.findByProjectId(id),
      ]);
      console.log('[ProjectDetail] loadData result: project=', p?.id ?? null, 'prompts=', prs.length);
      if (!p) {
        console.warn('[ProjectDetail] project not found, redirecting to /projects');
        router.push('/projects');
        return;
      }
      setProject(p);
      setPrompts(prs);
    } catch (err) {
      console.error('[ProjectDetail] loadData error:', err);
      const msg = err instanceof Error ? err.message
        : (err !== null && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err);
      setLoadError(`データの読み込みに失敗しました: ${msg}`);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDeleteProject = async () => {
    await projectRepository.delete(id);
    toast.success('案件を削除しました');
    router.push('/projects');
  };

  // --- Todo operations ---

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim() || !project) return;
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: newTodoTitle.trim(),
      completed: false,
      priority: newTodoPriority,
      dueDate: newTodoDueDate || null,
      createdAt: new Date().toISOString(),
    };
    const todos = [...(project.todos ?? []), newTodo];
    await projectRepository.update(id, { todos });
    setNewTodoTitle('');
    setNewTodoDueDate('');
    loadData();
  };

  const handleToggleTodo = async (todoId: string) => {
    if (!project) return;
    const todos = (project.todos ?? []).map((t) =>
      t.id === todoId ? { ...t, completed: !t.completed } : t
    );
    await projectRepository.update(id, { todos });
    loadData();
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!project) return;
    const todos = (project.todos ?? []).filter((t) => t.id !== todoId);
    await projectRepository.update(id, { todos });
    loadData();
  };

  const handleSaveTodoNote = async (todoId: string, note: string) => {
    if (!project) return;
    const todos = (project.todos ?? []).map((t) =>
      t.id === todoId ? { ...t, note } : t
    );
    await projectRepository.update(id, { todos });
    setEditingNote(null);
    loadData();
  };

  const handleBulkAddTodos = async () => {
    console.log('[TodoBulkImport] button clicked');
    console.log('[TodoBulkImport] raw input:', jsonInput);

    if (!project) {
      console.warn('[TodoBulkImport] project is null, aborting');
      setJsonError('案件データが読み込まれていません。ページを再読み込みしてください。');
      return;
    }

    // --- JSON パース ---
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (e) {
      console.warn('[TodoBulkImport] JSON.parse failed:', e);
      setJsonError('JSON形式が正しくありません');
      return;
    }
    console.log('[TodoBulkImport] parsed json:', parsed);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setJsonError('JSON形式が正しくありません（オブジェクト形式で入力してください）');
      return;
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.todo)) {
      setJsonError('todo 配列が見つかりません（"todo": [...] が必要です）');
      return;
    }

    const raw = obj.todo as unknown[];
    console.log('[TodoBulkImport] todo count:', raw.length);

    if (raw.length === 0) {
      setJsonError('todo 配列が空です');
      return;
    }

    // --- バリデーション ---
    const newTodos: Todo[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (typeof item !== 'object' || item === null) {
        setJsonError(`todo[${i}]: オブジェクト形式が正しくありません`);
        return;
      }
      const t = item as Record<string, unknown>;
      if (!t.title || typeof t.title !== 'string' || !t.title.trim()) {
        setJsonError(`todo[${i}]: title が空です（title は必須です）`);
        return;
      }
      const priority = (t.priority ?? 'medium') as string;
      if (!['low', 'medium', 'high'].includes(priority)) {
        setJsonError(`todo[${i}]: priority の値が不正です → "${priority}"（low / medium / high のいずれかにしてください）`);
        return;
      }
      const dueDate = t.dueDate ? String(t.dueDate).trim() : null;
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        setJsonError(`todo[${i}]: dueDate の形式が正しくありません → "${dueDate}"（YYYY-MM-DD 形式にしてください）`);
        return;
      }
      newTodos.push({
        id: crypto.randomUUID(),
        title: t.title.trim(),
        completed: false,
        priority: priority as TodoPriority,
        dueDate: dueDate || null,
        note: t.note ? String(t.note) : undefined,
        createdAt: new Date().toISOString(),
      });
    }

    console.log('[TodoBulkImport] validation passed, newTodos count:', newTodos.length);

    // --- 保存 ---
    setJsonLoading(true);
    setJsonError('');
    try {
      const todos = [...(project.todos ?? []), ...newTodos];
      console.log('[TodoBulkImport] addTodo called, total todos after:', todos.length);
      await projectRepository.update(id, { todos });
      console.log('[TodoBulkImport] success count:', newTodos.length);
      setJsonModalOpen(false);
      setJsonInput('');
      setJsonError('');
      toast.success(`${newTodos.length}件のToDoを追加しました`);
      loadData();
    } catch (err) {
      console.error('[TodoBulkImport] error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isAuthError = msg.includes('ログイン') || msg.includes('auth') || msg.includes('JWT') || msg.includes('401');
      setJsonError(isAuthError
        ? `ログインが必要です（${msg}）`
        : `ToDoの追加に失敗しました: ${msg}`
      );
    } finally {
      setJsonLoading(false);
    }
  };

  const handleFormatTodoJson = () => {
    try {
      setJsonInput(JSON.stringify(JSON.parse(jsonInput), null, 2));
      setJsonError('');
    } catch {
      setJsonError('JSON形式が正しくありません');
    }
  };

  const sampleTodoJson = JSON.stringify({
    todo: [
      { title: 'デザインカンプを確認する', priority: 'high', dueDate: '2026-04-10', note: 'Figmaリンクを確認' },
      { title: 'API仕様書を作成する', priority: 'medium', dueDate: '', note: '' },
      { title: 'テスト環境を構築する', priority: 'low' },
    ],
  }, null, 2);

  // --- Prompt operations ---

  const handleSavePrompt = async (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingPrompt) {
      await promptRepository.update(editingPrompt.id, data);
      toast.success('プロンプトを更新しました');
    } else {
      await promptRepository.create(data);
      toast.success('プロンプトを追加しました');
    }
    setPromptDialogOpen(false);
    setEditingPrompt(undefined);
    setPrompts(await promptRepository.findByProjectId(id));
  };

  const handleDeletePrompt = async () => {
    if (!deletePromptTarget) return;
    await promptRepository.delete(deletePromptTarget.id);
    toast.success('プロンプトを削除しました');
    setDeletePromptTarget(null);
    setPrompts(await promptRepository.findByProjectId(id));
  };

  const filteredPrompts = prompts
    .filter((p) => promptFilter === 'all' || p.category === promptFilter)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  if (loadError) return (
    <div className="p-6 space-y-3">
      <p className="text-red-400 text-sm">{loadError}</p>
      <button onClick={loadData} className="text-xs text-blue-400 hover:underline">再読み込み</button>
    </div>
  );
  if (!project) return <div className="p-6 text-gray-400">読み込み中...</div>;

  const todos = project.todos ?? [];
  const pct = calcProgress(todos);
  const doneTodos = todos.filter((t) => t.completed).length;
  const pendingTodos = todos.filter((t) => !t.completed);

  const today = getTodayStr();
  const weekEnd = getWeekEndStr();
  const overdueCount = todos.filter((t) => !t.completed && t.dueDate && t.dueDate < today).length;
  const todayCount = todos.filter((t) => !t.completed && t.dueDate === today).length;
  const weekCount = todos.filter((t) => !t.completed && t.dueDate && t.dueDate > today && t.dueDate <= weekEnd).length;

  const sortedTodos = sortTodos(todos, sortBy);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/projects" className="hover:text-white transition-colors">案件管理</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-300">{project.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-xl font-bold text-white">{project.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', statusColor[project.status] ?? 'bg-gray-600 text-white')}>
              {statusLabel[project.status] ?? project.status}
            </Badge>
            <span className="text-xs text-gray-500">{doneTodos}/{todos.length} Todo完了</span>
            {overdueCount > 0 && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                期限切れ {overdueCount}件
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3 max-w-sm">
            <ProgressBar pct={pct} className="flex-1" />
            <span className="text-sm font-bold text-white w-10 text-right">{pct}%</span>
          </div>
          {project.nextAction && (
            <p className="text-xs text-blue-400">
              <span className="text-gray-500">次のアクション: </span>{project.nextAction}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 border border-blue-700 text-blue-400 hover:bg-blue-900/30 rounded-md h-9 px-3 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              URLを開く
            </a>
          )}
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-9 text-xs" onClick={() => router.push(`/projects/${id}/edit`)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            編集
          </Button>
          <Button variant="outline" size="sm" className="border-red-900 text-red-400 hover:bg-red-900/30 h-9 text-xs" onClick={() => setShowDeleteProjectDialog(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            削除
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="todos">
        <TabsList className="bg-gray-800 border border-gray-700 h-auto">
          <TabsTrigger value="todos" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">
            ToDo
            {pendingTodos.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-orange-600 text-white rounded-full px-1.5 py-0">
                {pendingTodos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">概要</TabsTrigger>
          <TabsTrigger value="prompts" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">
            プロンプト
            {prompts.length > 0 && <span className="ml-1 text-[10px] text-gray-500">({prompts.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white text-xs">
            AIテンプレ
          </TabsTrigger>
        </TabsList>

        {/* ToDo タブ */}
        <TabsContent value="todos" className="mt-4 space-y-4">

          {/* 期限サマリー */}
          {(overdueCount > 0 || todayCount > 0 || weekCount > 0) && (
            <div className="flex flex-wrap gap-2">
              {overdueCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-900/30 border border-red-800/50 rounded-md px-2.5 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs text-red-400 font-medium">期限切れ {overdueCount}件</span>
                </div>
              )}
              {todayCount > 0 && (
                <div className="flex items-center gap-1.5 bg-yellow-900/30 border border-yellow-800/50 rounded-md px-2.5 py-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs text-yellow-400 font-medium">今日期限 {todayCount}件</span>
                </div>
              )}
              {weekCount > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-900/30 border border-blue-800/50 rounded-md px-2.5 py-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400 font-medium">今週期限 {weekCount}件</span>
                </div>
              )}
            </div>
          )}

          {/* Add form */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-400">ToDoを追加</p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/prompts?category=ToDo生成"
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-400 transition-colors"
                  >
                    <BookOpen className="w-3 h-3" />
                    ToDo生成プロンプト
                  </Link>
                  <button
                    onClick={() => { setJsonModalOpen(true); setJsonError(''); }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    JSONから追加
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                  placeholder="ToDoのタイトルを入力..."
                  className="bg-gray-700 border-gray-600 h-9 text-sm text-gray-100 placeholder:text-gray-500"
                />
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label className="text-[10px] text-gray-500 shrink-0">優先度</Label>
                    <Select value={newTodoPriority} onValueChange={(v) => setNewTodoPriority(v as TodoPriority)}>
                      <SelectTrigger className="flex-1 bg-gray-700 border-gray-600 h-8 text-xs text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label className="text-[10px] text-gray-500 shrink-0">期限</Label>
                    <input
                      type="date"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-md h-8 px-2 text-xs text-gray-100 min-w-0 [color-scheme:dark]"
                    />
                  </div>
                  <Button
                    onClick={handleAddTodo}
                    disabled={!newTodoTitle.trim()}
                    className="bg-blue-600 hover:bg-blue-700 h-8 text-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    追加
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sort control */}
          {todos.length > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Label className="text-[10px] text-gray-500">並び替え</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-32 bg-gray-800 border-gray-700 h-7 text-xs text-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {sortOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Todo list */}
          {todos.length === 0 ? (
            <p className="text-gray-600 text-sm py-3">ToDoがありません。上から追加してください。</p>
          ) : (
            <div className="space-y-2">
              {sortedTodos.map((todo) => {
                const isExpanded = expandedTodo === todo.id;
                const isEditingNote = editingNote?.id === todo.id;
                const dueSt = getDueDateStatus(todo.dueDate, todo.completed);

                return (
                  <Card
                    key={todo.id}
                    className={cn(
                      'border transition-colors',
                      todo.completed
                        ? 'bg-gray-900 border-gray-800'
                        : dueSt === 'overdue'
                          ? 'bg-gray-800 border-red-800/60'
                          : dueSt === 'today'
                            ? 'bg-gray-800 border-yellow-800/60'
                            : 'bg-gray-800 border-gray-700'
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleTodo(todo.id)}
                          className="mt-0.5 shrink-0 text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          {todo.completed
                            ? <CheckSquare className="w-5 h-5 text-green-500" />
                            : <Square className="w-5 h-5" />
                          }
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'text-sm font-medium',
                              todo.completed ? 'line-through text-gray-600' : 'text-gray-100'
                            )}>
                              {todo.title}
                            </span>
                            <Badge className={cn('text-[10px] px-1.5 py-0', priorityColor[todo.priority])}>
                              {priorityLabel[todo.priority]}
                            </Badge>
                          </div>

                          {/* Due date */}
                          <div className="mt-1">
                            <DueDateBadge dueDate={todo.dueDate} completed={todo.completed} />
                          </div>

                          {/* Note */}
                          {isEditingNote ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editingNote.value}
                                onChange={(e) => setEditingNote({ id: todo.id, value: e.target.value })}
                                rows={3}
                                placeholder="メモを入力..."
                                className="bg-gray-700 border-gray-600 text-gray-100 text-xs resize-y"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => handleSaveTodoNote(todo.id, editingNote.value)}>保存</Button>
                                <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-700 h-7 text-xs" onClick={() => setEditingNote(null)}>キャンセル</Button>
                              </div>
                            </div>
                          ) : (
                            todo.note && (
                              <p className={cn(
                                'text-xs mt-1.5',
                                isExpanded ? 'text-gray-400 whitespace-pre-wrap' : 'text-gray-500 truncate'
                              )}>
                                {todo.note}
                              </p>
                            )
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              if (isEditingNote) {
                                setEditingNote(null);
                              } else {
                                setEditingNote({ id: todo.id, value: todo.note ?? '' });
                                setExpandedTodo(todo.id);
                              }
                            }}
                            className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                            title="メモを編集"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {todo.note && !isEditingNote && (
                            <button
                              onClick={() => setExpandedTodo(isExpanded ? null : todo.id)}
                              className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-1 text-gray-700 hover:text-red-400 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {todos.length > 0 && (
            <div className="text-xs text-gray-600 pt-1">
              {doneTodos}/{todos.length} 完了 · {pendingTodos.length} 件残り
            </div>
          )}
        </TabsContent>

        {/* 概要 */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-5">
              <dl>
                <FieldRow label="概要" value={project.summary} />
                <FieldRow label="次のアクション" value={project.nextAction ?? ''} />
                {project.url && (
                  <div className="py-2.5 border-b border-gray-700">
                    <dt className="text-xs text-gray-500 mb-0.5">URL</dt>
                    <dd>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm text-blue-400 hover:text-blue-300 underline break-all"
                      >
                        {project.url}
                      </a>
                    </dd>
                  </div>
                )}
                <FieldRow label="対象ユーザー" value={project.target} />
                <FieldRow label="解決したい課題" value={project.problem} />
                <FieldRow label="MVP機能" value={project.mvpFeatures} />
                <FieldRow label="将来機能" value={project.futureFeatures} />
                <FieldRow label="技術スタック" value={project.techStack} />
                <FieldRow label="デザイン方針" value={project.designPolicy} />
                <FieldRow label="メモ" value={project.memo} />
                <div className="py-2.5 border-b border-gray-700">
                  <dt className="text-xs text-gray-500 mb-0.5">作成日</dt>
                  <dd className="text-sm text-gray-100">{(project.createdAt ?? project.updatedAt ?? '').slice(0, 10)}</dd>
                </div>
                <div className="py-2.5">
                  <dt className="text-xs text-gray-500 mb-0.5">最終更新</dt>
                  <dd className="text-sm text-gray-100">{(project.updatedAt ?? project.createdAt ?? '').slice(0, 10)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* プロンプト */}
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
                        <span className="text-xs text-gray-500">{(pr.updatedAt ?? pr.createdAt ?? '').slice(0, 10)}</span>
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

        {/* AIテンプレ */}
        <TabsContent value="templates" className="mt-4">
          <TemplatePromptsPanel project={project} />
        </TabsContent>
      </Tabs>

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

      {/* JSON一括追加モーダル */}
      <Dialog open={jsonModalOpen} onOpenChange={(open) => { if (jsonLoading) return; setJsonModalOpen(open); if (!open) { setJsonInput(''); setJsonError(''); } }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 w-[92vw] max-w-lg flex flex-col max-h-[88dvh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileJson className="w-4 h-4 text-blue-400" />
              JSONからToDoを一括追加
            </DialogTitle>
            <p className="text-xs text-gray-500 font-normal">
              ChatGPT / Claude で生成した JSON を貼り付けてください。
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            <Textarea
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setJsonError(''); }}
              placeholder={'{\n  "todo": [\n    {\n      "title": "タスク名",\n      "priority": "medium",\n      "dueDate": "2026-04-10",\n      "note": "メモ"\n    }\n  ]\n}'}
              className="bg-gray-800 border-gray-700 text-gray-100 text-xs font-mono min-h-[200px] max-h-[40vh] resize-none overflow-y-auto"
              disabled={jsonLoading}
            />

            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] text-gray-600">
                {jsonInput.length > 0 ? `${jsonInput.length} 文字` : ''}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={jsonLoading}
                  onClick={() => { setJsonInput(sampleTodoJson); setJsonError(''); }}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline-offset-2 hover:underline disabled:opacity-40"
                >
                  サンプルを挿入
                </button>
                {jsonInput.trim() && (
                  <button
                    type="button"
                    disabled={jsonLoading}
                    onClick={handleFormatTodoJson}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    JSONを整形
                  </button>
                )}
              </div>
            </div>

            {/* エラー表示（フッター直前で常に見える位置） */}
            {jsonError && (
              <div className="rounded-md bg-red-900/40 border border-red-700/60 px-3 py-2">
                <p className="text-red-300 text-xs leading-relaxed">{jsonError}</p>
              </div>
            )}
          </div>

          <div className="shrink-0 -mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t border-gray-700/70 bg-gray-900 px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={jsonLoading}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 h-10 w-full sm:w-auto sm:h-9 text-sm disabled:opacity-40"
              onClick={() => setJsonModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              disabled={!jsonInput.trim() || jsonLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 h-10 w-full sm:w-auto sm:h-9 text-sm"
              onClick={handleBulkAddTodos}
            >
              {jsonLoading ? '追加中...' : '一括追加'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
