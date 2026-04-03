'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Project, ProjectPhase, AICOMPANYRole } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { promptRepository } from '@/lib/repository/promptRepository';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

export const phaseLabel: Record<ProjectPhase, string> = {
  consulting: '相談中',
  requirements: '要件整理',
  research: '調査中',
  design: '設計中',
  ui_design: 'UI設計中',
  implementation: '実装中',
  review: 'レビュー中',
  deploy_prep: 'デプロイ準備',
  done: '完了',
};

export const phaseColor: Record<ProjectPhase, string> = {
  consulting: 'bg-gray-600 text-white',
  requirements: 'bg-indigo-700 text-white',
  research: 'bg-cyan-700 text-white',
  design: 'bg-violet-700 text-white',
  ui_design: 'bg-purple-700 text-white',
  implementation: 'bg-blue-700 text-white',
  review: 'bg-orange-700 text-white',
  deploy_prep: 'bg-yellow-700 text-white',
  done: 'bg-green-800 text-white',
};

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

const STUCK_DAYS = 3;

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function missingNoteCount(p: Project): number {
  const fields = [
    p.secretaryNotes, p.researcherNotes, p.architectNotes,
    p.uiDesignerNotes, p.coderNotes, p.reviewerNotes, p.deployerNotes,
  ];
  return fields.filter((f) => !f).length;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    setProjects(projectRepository.findAll());
    setPromptCount(promptRepository.findAll().length);
  }, []);

  const activeProjects = projects
    .filter((p) => p.status !== 'done' && p.status !== 'paused')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const stuckCount = activeProjects.filter((p) => daysSince(p.updatedAt) >= STUCK_DAYS).length;

  // 工程別件数
  const phaseCounts: Partial<Record<ProjectPhase, number>> = {};
  for (const p of activeProjects) {
    if (p.currentPhase) phaseCounts[p.currentPhase] = (phaseCounts[p.currentPhase] ?? 0) + 1;
  }

  // 担当別件数
  const ownerCounts: Partial<Record<AICOMPANYRole, number>> = {};
  for (const p of activeProjects) {
    if (p.currentOwner) ownerCounts[p.currentOwner] = (ownerCounts[p.currentOwner] ?? 0) + 1;
  }

  const allPhases = Object.keys(phaseLabel) as ProjectPhase[];
  const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">司令塔ダッシュボード</h1>
          <p className="text-xs text-gray-500 mt-0.5">AICOMPANY — 案件進行状況</p>
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
          { label: '全案件', value: projects.length, color: 'text-white' },
          { label: '進行中', value: activeProjects.length, color: 'text-blue-400' },
          { label: `${STUCK_DAYS}日以上停滞`, value: stuckCount, color: 'text-yellow-400' },
          { label: 'プロンプト', value: promptCount, color: 'text-gray-300' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 進行中案件 — メイン */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-300">進行中の案件</h2>
          <Link href="/projects" className="text-xs text-blue-400 hover:text-blue-300">一覧へ →</Link>
        </div>

        {activeProjects.length === 0 ? (
          <p className="text-gray-600 text-sm py-3">進行中の案件はありません</p>
        ) : (
          <div className="border border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
            <div className="min-w-[520px]">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_120px_140px_100px_auto] gap-3 px-4 py-2 bg-gray-800/60 text-xs text-gray-500 font-medium border-b border-gray-700">
              <span>案件名</span>
              <span>現在工程</span>
              <span>担当 → 次担当</span>
              <span>更新</span>
              <span>状態</span>
            </div>
            {activeProjects.map((p, i) => {
              const stuck = daysSince(p.updatedAt) >= STUCK_DAYS;
              const missingNotes = missingNoteCount(p);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={cn(
                    'grid grid-cols-[1fr_120px_140px_100px_auto] gap-3 px-4 py-3 items-center transition-colors hover:bg-gray-700/50',
                    i !== activeProjects.length - 1 && 'border-b border-gray-700/60'
                  )}
                >
                  {/* 案件名 */}
                  <span className="text-sm text-white font-medium truncate">{p.title}</span>

                  {/* 現在工程 */}
                  <div>
                    {p.currentPhase ? (
                      <Badge className={cn('text-[10px] px-1.5 py-0', phaseColor[p.currentPhase])}>
                        {phaseLabel[p.currentPhase]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-600">未設定</span>
                    )}
                  </div>

                  {/* 担当 → 次担当 */}
                  <div className="flex items-center gap-1.5">
                    {p.currentOwner ? (
                      <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.currentOwner])}>
                        {roleLabel[p.currentOwner]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-600">未設定</span>
                    )}
                    {p.nextOwner && (
                      <>
                        <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                        <Badge className={cn('text-[10px] px-1.5 py-0 opacity-75', roleColor[p.nextOwner as AICOMPANYRole])}>
                          {roleLabel[p.nextOwner as AICOMPANYRole]}
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* 更新日 */}
                  <span className="text-xs text-gray-500">{p.updatedAt.slice(5, 10)}</span>

                  {/* 状態アイコン */}
                  <div className="flex items-center gap-1.5">
                    {stuck && (
                      <span title={`${Math.floor(daysSince(p.updatedAt))}日更新なし`}>
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      </span>
                    )}
                    {missingNotes > 0 && (
                      <span title={`担当メモ ${missingNotes}件未記入`}>
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* 工程別 / 担当別サマリー */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">工程別（進行中）</h3>
          <div className="space-y-1.5">
            {allPhases.filter((ph) => ph !== 'done').map((ph) => {
              const count = phaseCounts[ph] ?? 0;
              return (
                <div key={ph} className="flex items-center gap-2">
                  <Badge className={cn('text-[10px] w-24 justify-center shrink-0', phaseColor[ph])}>
                    {phaseLabel[ph]}
                  </Badge>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: activeProjects.length ? `${(count / activeProjects.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">担当別（進行中）</h3>
          <div className="space-y-1.5">
            {allRoles.map((role) => {
              const count = ownerCounts[role] ?? 0;
              return (
                <div key={role} className="flex items-center gap-2">
                  <Badge className={cn('text-[10px] w-24 justify-center shrink-0', roleColor[role])}>
                    {roleLabel[role]}
                  </Badge>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: activeProjects.length ? `${(count / activeProjects.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
