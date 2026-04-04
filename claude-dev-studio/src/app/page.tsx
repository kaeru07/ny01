'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Project, AICOMPANYRole, Todo } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { promptRepository } from '@/lib/repository/promptRepository';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, CheckSquare, TrendingUp, ListTodo, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { storage } from '@/lib/repository/storage';

// プロンプト管理ページで使用するため引き続きエクスポート
export const roleLabel: Record<AICOMPANYRole, string> = {
  secretary: 'Secretary',
  researcher: 'Researcher',
  architect: 'Architect',
  ui_designer: 'UI Designer',
  coder: 'Coder',
  reviewer: 'Reviewer',
  deployer: 'Deployer',
};

export const roleColor: Record<AICOMPANYRole, string> = {
  secretary: 'bg-slate-600 text-white',
  researcher: 'bg-cyan-800 text-white',
  architect: 'bg-violet-800 text-white',
  ui_designer: 'bg-purple-800 text-white',
  coder: 'bg-blue-800 text-white',
  reviewer: 'bg-orange-800 text-white',
  deployer: 'bg-green-800 text-white',
};

export const statusLabel: Record<string, string> = {
  planning: '未着手',
  active: '進行中',
  adjusting: '調整中',
  done: '完了',
  paused: '保留',
};

export const statusColor: Record<string, string> = {
  planning: 'bg-gray-600 text-white',
  active: 'bg-blue-700 text-white',
  adjusting: 'bg-yellow-700 text-white',
  done: 'bg-green-800 text-white',
  paused: 'bg-orange-800 text-white',
};

export function calcProgress(todos: Todo[]): number {
  if (!todos?.length) return 0;
  return Math.round((todos.filter((t) => t.completed).length / todos.length) * 100);
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-gray-700 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-blue-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// 期限ユーティリティ（[id]/page.tsx でも使用）
export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekEndStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export type DueDateStatus = 'overdue' | 'today' | 'upcoming' | 'none';

export function getDueDateStatus(
  dueDate: string | null | undefined,
  completed: boolean
): DueDateStatus {
  if (completed || !dueDate) return 'none';
  const today = getTodayStr();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return 'upcoming';
}

async function migrateFromLocalStorage() {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 既にSupabaseにデータがあれば移行しない
  const existing = await projectRepository.findAll();
  if (existing.length > 0) return;

  const localProjects = storage.get<Project[]>('cds_projects') ?? [];
  if (localProjects.length === 0) return;

  // localStorageのプロジェクトとプロンプトをインポート
  for (const p of localProjects) {
    await supabase.from('projects').insert({
      id: p.id,
      user_id: user.id,
      title: p.title,
      summary: p.summary,
      target: p.target,
      problem: p.problem,
      mvp_features: p.mvpFeatures,
      future_features: p.futureFeatures,
      tech_stack: p.techStack,
      design_policy: p.designPolicy,
      memo: p.memo,
      status: p.status,
      todos: p.todos ?? [],
      next_action: p.nextAction ?? '',
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
  }

  const localPrompts = storage.get<{
    id: string; projectId: string; category: string; version: string;
    title: string; body: string; changeMemo: string; targetRole?: string;
    createdAt: string; updatedAt: string;
  }[]>('cds_prompts') ?? [];

  for (const pr of localPrompts) {
    await supabase.from('prompts').insert({
      id: pr.id,
      user_id: user.id,
      project_id: pr.projectId,
      category: pr.category,
      version: pr.version,
      title: pr.title,
      body: pr.body,
      change_memo: pr.changeMemo,
      target_role: pr.targetRole ?? '',
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
    });
  }

  toast.success(
    `ローカルデータを移行しました（案件 ${localProjects.length}件、プロンプト ${localPrompts.length}件）`,
    { duration: 5000 }
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    async function load() {
      await migrateFromLocalStorage();
      const [ps, prs] = await Promise.all([
        projectRepository.findAll(),
        promptRepository.findAll(),
      ]);
      setProjects(ps);
      setPromptCount(prs.length);
    }
    load();
  }, []);

  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'adjusting');
  const doneProjects = projects.filter((p) => p.status === 'done');
  const pausedProjects = projects.filter((p) => p.status === 'paused');

  // 平均進捗率（完了以外の全案件）
  const nonDone = projects.filter((p) => p.status !== 'done');
  const avgProgress =
    nonDone.length === 0
      ? 0
      : Math.round(nonDone.reduce((acc, p) => acc + calcProgress(p.todos ?? []), 0) / nonDone.length);

  // 期限関連集計（完了以外の全案件の未完了Todo）
  const today = getTodayStr();
  const weekEnd = getWeekEndStr();
  let overdueCount = 0;
  let todayCount = 0;
  let weekCount = 0;
  for (const p of projects) {
    if (p.status === 'done') continue;
    for (const t of p.todos ?? []) {
      if (t.completed || !t.dueDate) continue;
      if (t.dueDate < today) overdueCount++;
      else if (t.dueDate === today) todayCount++;
      else if (t.dueDate <= weekEnd) weekCount++;
    }
  }

  // 未完了Todoが多い案件 top3
  const topPendingTodo = [...projects]
    .filter((p) => p.status !== 'done')
    .map((p) => ({
      ...p,
      pendingCount: (p.todos ?? []).filter((t) => !t.completed).length,
    }))
    .filter((p) => p.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .slice(0, 3);

  // 次アクションがある案件
  const hasNextAction = projects
    .filter((p) => p.status !== 'done' && p.nextAction)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  // 進行中の案件一覧（ダッシュボード表示用）
  const displayProjects = [...projects]
    .filter((p) => p.status !== 'done')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  const hasDueAlerts = overdueCount > 0 || todayCount > 0 || weekCount > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ダッシュボード</h1>
          <p className="text-xs text-gray-500 mt-0.5">AICOMPANY — 案件進捗管理</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規案件
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '進行中', value: activeProjects.length, color: 'text-blue-400' },
          { label: '完了', value: doneProjects.length, color: 'text-green-400' },
          { label: '保留', value: pausedProjects.length, color: 'text-orange-400' },
          { label: '平均進捗', value: `${avgProgress}%`, color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 期限アラート */}
      {hasDueAlerts && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-300">期限アラート</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <div>
                  <p className="text-xs text-red-400 font-medium">期限切れ</p>
                  <p className="text-lg font-bold text-red-300">{overdueCount}件</p>
                </div>
              </div>
            )}
            {todayCount > 0 && (
              <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-800/50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-xs text-yellow-400 font-medium">今日期限</p>
                  <p className="text-lg font-bold text-yellow-300">{todayCount}件</p>
                </div>
              </div>
            )}
            {weekCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs text-blue-400 font-medium">今週期限</p>
                  <p className="text-lg font-bold text-blue-300">{weekCount}件</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 進行中の案件 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-300">進行中の案件</h2>
          <Link href="/projects" className="text-xs text-blue-400 hover:text-blue-300">一覧へ →</Link>
        </div>

        {displayProjects.length === 0 ? (
          <p className="text-gray-600 text-sm py-3">案件がありません</p>
        ) : (
          <div className="space-y-2">
            {displayProjects.map((p) => {
              const pct = calcProgress(p.todos ?? []);
              const totalTodos = (p.todos ?? []).length;
              const pendingTodos = (p.todos ?? []).filter((t) => !t.completed).length;
              const projectOverdue = (p.todos ?? []).some(
                (t) => !t.completed && t.dueDate && t.dueDate < today
              );
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{p.title}</span>
                      <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', statusColor[p.status] ?? 'bg-gray-600 text-white')}>
                        {statusLabel[p.status] ?? p.status}
                      </Badge>
                      {projectOverdue && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                    </div>
                    <ProgressBar pct={pct} />
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-bold text-white">{pct}%</p>
                    {totalTodos > 0 && (
                      <p className="text-[10px] text-gray-500">{pendingTodos}件残</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 下段: 未完了ToDoが多い / 次アクションあり */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 未完了ToDoが多い案件 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListTodo className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-semibold text-gray-300">未完了Todoが多い案件</h3>
          </div>
          {topPendingTodo.length === 0 ? (
            <p className="text-xs text-gray-600">なし</p>
          ) : (
            <div className="space-y-2">
              {topPendingTodo.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between group">
                  <span className="text-xs text-gray-300 group-hover:text-white truncate flex-1">{p.title}</span>
                  <span className="text-xs text-orange-400 font-medium ml-2 shrink-0">{p.pendingCount}件</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 次にやることがある案件 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-gray-300">次アクションあり</h3>
          </div>
          {hasNextAction.length === 0 ? (
            <p className="text-xs text-gray-600">なし</p>
          ) : (
            <div className="space-y-2">
              {hasNextAction.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block group">
                  <p className="text-xs text-gray-300 group-hover:text-white truncate">{p.title}</p>
                  <p className="text-[10px] text-blue-400 truncate mt-0.5">{p.nextAction}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* プロンプト数 */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <CheckSquare className="w-3.5 h-3.5" />
        <span>プロンプト: {promptCount}件登録済み</span>
      </div>
    </div>
  );
}
