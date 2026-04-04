'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const plannedFeatures = [
  'チームメンバー招待・共有',
  'プロンプトのテンプレートライブラリ',
  'GitHubリポジトリ連携',
  'AIによる案件サマリー生成',
  'エクスポート（JSON / Markdown）',
];

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">設定</h1>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-300 text-sm flex items-center gap-2">
            クラウド同期
            <Badge className={isSupabaseConfigured ? 'bg-green-700 text-white text-xs' : 'bg-gray-600 text-white text-xs'}>
              {isSupabaseConfigured ? '有効' : '未設定'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          {isSupabaseConfigured ? (
            <>
              <p>Supabase で端末間同期が有効です。</p>
              {user && (
                <div className="flex justify-between">
                  <span>ログイン中</span>
                  <span className="text-white font-mono">{user.email}</span>
                </div>
              )}
            </>
          ) : (
            <p>
              <code className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> と{' '}
              <code className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
              を設定すると Supabase での端末間同期が有効になります。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-300 text-sm flex items-center gap-2">
            将来実装予定
            <Badge className="bg-yellow-600 text-white text-xs">予定</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
            <span className="text-white font-mono">v3.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>データ保存先</span>
            <span className="text-white font-mono">
              {isSupabaseConfigured ? 'Supabase' : 'localStorage (ローカル)'}
            </span>
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
