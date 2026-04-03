'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const plannedFeatures = [
  'クラウド同期（Supabase）',
  'チームメンバー招待・共有',
  'プロンプトのテンプレートライブラリ',
  'GitHubリポジトリ連携',
  'AIによる案件サマリー生成',
  'タスク進捗トラッキング',
  'エクスポート（JSON / Markdown）',
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">設定</h1>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-300 text-sm flex items-center gap-2">
            設定ページ
            <Badge className="bg-yellow-600 text-white text-xs">将来実装予定</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm mb-4">
            現在、設定機能は開発中です。以下の機能を将来実装予定です。
          </p>
          <ul className="space-y-2">
            {plannedFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-300 text-sm">アプリ情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>バージョン</span>
            <span className="text-white font-mono">v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>データ保存先</span>
            <span className="text-white font-mono">localStorage</span>
          </div>
          <div className="flex justify-between">
            <span>フレームワーク</span>
            <span className="text-white font-mono">Next.js (App Router)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
