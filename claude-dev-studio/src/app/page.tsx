'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Project, ProjectPhase, AICOMPANYRole } from '@/types';
import { projectRepository } from '@/lib/repository/projectRepository';
import { promptRepository } from '@/lib/repository/promptRepository';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, Clock, ArrowRight, Users, Layers } from 'lucide-react';

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

function hasAnyNote(p: Project): boolean {
  return !!(
    p.secretaryNotes ||
    p.researcherNotes ||
    p.architectNotes ||
    p.uiDesignerNotes ||
    p.coderNotes ||
    p.reviewerNotes ||
    p.deployerNotes
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    setProjects(projectRepository.findAll());
    setPromptCount(promptRepository.findAll().length);
  }, []);

  const activeProjects = projects.filter((p) => p.status !== 'done');
  const stuckProjects = activeProjects.filter((p) => daysSince(p.updatedAt) >= STUCK_DAYS);
  const noNotesProjects = activeProjects.filter((p) => !hasAnyNote(p));
  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  // 工程別件数
  const phaseCounts: Partial<Record<ProjectPhase, number>> = {};
  for (const p of activeProjects) {
    if (p.currentPhase) {
      phaseCounts[p.currentPhase] = (phaseCounts[p.currentPhase] ?? 0) + 1;
    }
  }

  // 担当別件数
  const ownerCounts: Partial<Record<AICOMPANYRole, number>> = {};
  for (const p of activeProjects) {
    if (p.currentOwner) {
      ownerCounts[p.currentOwner] = (ownerCounts[p.currentOwner] ?? 0) + 1;
    }
  }

  // 次に着手すべき案件（currentOwner設定あり・進行中・更新が新しい順）
  const nextUp = activeProjects
    .filter((p) => p.currentOwner)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  const allPhases = Object.keys(phaseLabel) as ProjectPhase[];
  const allRoles = Object.keys(roleLabel) as AICOMPANYRole[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">司令塔ダッシュボード</h1>
          <p className="text-xs text-gray-500 mt-0.5">AICOMPANY — 案件進行状況の全体把握</p>
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
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">全案件</p>
            <p className="text-3xl font-bold text-white">{projects.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">進行中</p>
            <p className="text-3xl font-bold text-blue-400">{activeProjects.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              {STUCK_DAYS}日以上停滞
            </p>
            <p className="text-3xl font-bold text-yellow-400">{stuckProjects.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">プロンプト数</p>
            <p className="text-3xl font-bold text-gray-300">{promptCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* 工程別 / 担当別サマリー */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 工程別サマリー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {allPhases.filter((ph) => ph !== 'done').map((ph) => {
                const count = phaseCounts[ph] ?? 0;
                return (
                  <div key={ph} className="flex items-center gap-2">
                    <Badge className={cn('text-xs w-28 justify-center shrink-0', phaseColor[ph])}>
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
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> 担当別サマリー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {allRoles.map((role) => {
                const count = ownerCounts[role] ?? 0;
                return (
                  <div key={role} className="flex items-center gap-2">
                    <Badge className={cn('text-xs w-28 justify-center shrink-0', roleColor[role])}>
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
          </CardContent>
        </Card>
      </div>

      {/* 次に着手すべき / 停滞 / メモ不足 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 次に着手すべき */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">次に着手すべき案件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextUp.length === 0 && (
              <p className="text-gray-600 text-xs">担当設定済みの案件がありません</p>
            )}
            {nextUp.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <div className="p-2 rounded hover:bg-gray-700 transition-colors space-y-1">
                  <p className="text-sm text-white truncate">{p.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.currentPhase && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', phaseColor[p.currentPhase])}>
                        {phaseLabel[p.currentPhase]}
                      </Badge>
                    )}
                    {p.currentOwner && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.currentOwner])}>
                        {roleLabel[p.currentOwner]}
                      </Badge>
                    )}
                    {p.nextOwner && (
                      <>
                        <ArrowRight className="w-3 h-3 text-gray-500" />
                        <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.nextOwner as AICOMPANYRole])}>
                          {roleLabel[p.nextOwner as AICOMPANYRole]}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 停滞中 */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              停滞中の案件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stuckProjects.length === 0 && (
              <p className="text-gray-600 text-xs">停滞中の案件はありません</p>
            )}
            {stuckProjects.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <div className="p-2 rounded hover:bg-gray-700 transition-colors space-y-1">
                  <p className="text-sm text-white truncate">{p.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs text-yellow-500">
                      {Math.floor(daysSince(p.updatedAt))}日更新なし
                    </span>
                    {p.currentOwner && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.currentOwner])}>
                        {roleLabel[p.currentOwner]}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* メモ不足 */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">メモ未記入の案件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {noNotesProjects.length === 0 && (
              <p className="text-gray-600 text-xs">全案件にメモがあります</p>
            )}
            {noNotesProjects.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <div className="p-2 rounded hover:bg-gray-700 transition-colors space-y-1">
                  <p className="text-sm text-white truncate">{p.title}</p>
                  <div className="flex items-center gap-1.5">
                    {p.currentPhase && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', phaseColor[p.currentPhase])}>
                        {phaseLabel[p.currentPhase]}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">担当メモなし</span>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 最近更新した案件 */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-300">最近更新した案件</CardTitle>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 && (
            <p className="text-gray-600 text-xs">案件がありません</p>
          )}
          <div className="divide-y divide-gray-700">
            {recentProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <div className="py-2.5 flex items-center gap-3 hover:bg-gray-700/50 -mx-2 px-2 rounded transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.currentPhase && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', phaseColor[p.currentPhase])}>
                        {phaseLabel[p.currentPhase]}
                      </Badge>
                    )}
                    {p.currentOwner && (
                      <Badge className={cn('text-[10px] px-1.5 py-0', roleColor[p.currentOwner])}>
                        {roleLabel[p.currentOwner]}
                      </Badge>
                    )}
                    {p.nextOwner && (
                      <>
                        <ArrowRight className="w-3 h-3 text-gray-600" />
                        <Badge className={cn('text-[10px] px-1.5 py-0 opacity-70', roleColor[p.nextOwner as AICOMPANYRole])}>
                          {roleLabel[p.nextOwner as AICOMPANYRole]}
                        </Badge>
                      </>
                    )}
                    <span className="text-xs text-gray-500">{p.updatedAt.slice(0, 10)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
