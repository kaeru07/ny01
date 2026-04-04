'use client';

import { useEffect, useState } from 'react';
import { TemplatePrompt, Project } from '@/types';
import { templatePromptRepository } from '@/lib/repository/templatePromptRepository';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Copy, Check, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

// ---------- 変数置換 ----------

/**
 * プロンプト本文の {{project.xxx}} を案件データで置換する
 * 将来: {{project.todo}}, {{project.status}} 等を追加するだけでOK
 */
function resolveVariables(content: string, project?: Project | null): string {
  if (!project) return content;
  return content
    .replace(/\{\{project\.title\}\}/g, project.title ?? '')
    .replace(/\{\{project\.summary\}\}/g, project.summary ?? '')
    .replace(/\{\{project\.problem\}\}/g, project.problem ?? '')
    .replace(/\{\{project\.targetUsers\}\}/g, project.target ?? '')
    .replace(/\{\{project\.tech\}\}/g, project.techStack ?? '')
    .replace(/\{\{project\.memo\}\}/g, project.memo ?? '')
    // 将来拡張用（定義だけしておく）
    .replace(/\{\{project\.status\}\}/g, project.status ?? '')
    .replace(/\{\{project\.mvp\}\}/g, project.mvpFeatures ?? '')
    .replace(/\{\{project\.design\}\}/g, project.designPolicy ?? '');
}

// カテゴリ優先表示順
const PRIORITY_CATEGORIES = ['案件生成', 'ToDo生成', '改修', '設計', '調査'];

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

function getCategoryColor(category: string, allCategories: string[]): string {
  const idx = allCategories.indexOf(category);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0];
}

// カテゴリを優先順にソート
function sortCategories(categories: string[]): string[] {
  const priority = PRIORITY_CATEGORIES;
  const prioritized = priority.filter((c) => categories.includes(c));
  const rest = categories.filter((c) => !priority.includes(c)).sort();
  return prioritized.concat(rest);
}

// ---------- TemplatePromptCard ----------

interface CardProps {
  prompt: TemplatePrompt;
  categoryColor: string;
  project?: Project | null;
  onShowFull: () => void;
}

function TemplatePromptCard({ prompt, categoryColor, project, onShowFull }: CardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    const resolved = resolveVariables(prompt.content, project);
    await navigator.clipboard.writeText(resolved);
    setCopied(true);
    toast.success('コピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  // 変数が含まれているかどうか
  const hasVars = /\{\{project\.\w+\}\}/.test(prompt.content);

  const tagList = prompt.tags
    ? prompt.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const isLong = prompt.content.split('\n').length > 5 || prompt.content.length > 250;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-3.5">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Badge className={cn('text-xs px-2 py-0', categoryColor)}>
                {prompt.category}
              </Badge>
              {tagList.map((tag) => (
                <span key={tag} className="text-[10px] text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-white text-sm font-semibold leading-snug">{prompt.name}</h4>
              {hasVars && project && (
                <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
                  案件埋め込み済
                </span>
              )}
              {hasVars && !project && (
                <span className="text-[10px] text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                  変数あり
                </span>
              )}
            </div>
            {prompt.description && (
              <p className="text-xs text-gray-500 mt-0.5">{prompt.description}</p>
            )}
          </div>

          {/* コピーボタン（大きく・押しやすく） */}
          <Button
            size="sm"
            className={cn(
              'h-9 px-3 text-xs font-medium shrink-0 transition-colors',
              copied
                ? 'bg-green-600 hover:bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
            onClick={handleCopy}
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 mr-1" />コピー済</>
              : <><Copy className="w-3.5 h-3.5 mr-1" />コピー</>
            }
          </Button>
        </div>

        {/* Content preview */}
        <div
          className={cn(
            'text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900/60 rounded p-2.5',
            !expanded && 'line-clamp-4',
            isLong && 'cursor-pointer'
          )}
          onClick={() => isLong && setExpanded(!expanded)}
        >
          {prompt.content}
        </div>

        {/* Expand / Full view buttons */}
        <div className="flex items-center gap-3 mt-1.5">
          {isLong && (
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" />折りたたむ</>
                : <><ChevronDown className="w-3 h-3" />全文を表示</>
              }
            </button>
          )}
          <button
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-300 transition-colors ml-auto"
            onClick={onShowFull}
          >
            <FileText className="w-3 h-3" />
            モーダルで開く
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Full Content Modal ----------

interface FullModalProps {
  prompt: TemplatePrompt | null;
  project?: Project | null;
  onClose: () => void;
}

function FullContentModal({ prompt, project, onClose }: FullModalProps) {
  const [copied, setCopied] = useState(false);

  const resolvedContent = prompt ? resolveVariables(prompt.content, project) : '';
  const hasVars = prompt ? /\{\{project\.\w+\}\}/.test(prompt.content) : false;
  const isResolved = hasVars && !!project;

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(resolvedContent);
    setCopied(true);
    toast.success('コピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl w-full max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-white text-base leading-snug">{prompt?.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {prompt?.description && (
                  <p className="text-xs text-gray-500">{prompt.description}</p>
                )}
                {isResolved && (
                  <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded shrink-0">
                    案件情報埋め込み済
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className={cn(
                'h-8 px-3 text-xs shrink-0 transition-colors',
                copied
                  ? 'bg-green-600 hover:bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
              onClick={handleCopy}
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 mr-1" />コピー済</>
                : <><Copy className="w-3.5 h-3.5 mr-1" />コピー</>
              }
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-gray-800/60 rounded-lg p-4">
            {resolvedContent}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Panel ----------

interface Props {
  /** 案件情報（変数置換に使用） */
  project?: Project | null;
}

export function TemplatePromptsPanel({ project }: Props) {
  const [templates, setTemplates] = useState<TemplatePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fullViewTarget, setFullViewTarget] = useState<TemplatePrompt | null>(null);

  useEffect(() => {
    templatePromptRepository.findAll().then((data) => {
      setTemplates(data);
      setLoading(false);
    }).catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const allCategories = sortCategories([...new Set(templates.map((t) => t.category).filter(Boolean))]);

  const filtered = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  if (loading) {
    return <p className="text-gray-500 text-sm py-6 text-center">読み込み中...</p>;
  }

  if (templates.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center gap-3">
        <p className="text-gray-500 text-sm">テンプレートがまだありません</p>
        <Link
          href="/prompts"
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          プロンプト管理画面で追加する
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setCategoryFilter('all')}
          className={cn(
            'px-2.5 py-1 rounded text-xs font-medium transition-colors',
            categoryFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          )}
        >
          すべて
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              categoryFilter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            )}
          >
            {cat}
          </button>
        ))}
        <Link
          href="/prompts"
          className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          管理画面 →
        </Link>
      </div>

      {/* Template cards */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">
          このカテゴリにはテンプレートがありません
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <TemplatePromptCard
              key={t.id}
              prompt={t}
              categoryColor={getCategoryColor(t.category, allCategories)}
              project={project}
              onShowFull={() => setFullViewTarget(t)}
            />
          ))}
        </div>
      )}

      {/* Full content modal */}
      <FullContentModal
        prompt={fullViewTarget}
        project={project}
        onClose={() => setFullViewTarget(null)}
      />
    </div>
  );
}
