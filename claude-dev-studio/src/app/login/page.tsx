'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signInWithOtp(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
          <h1 className="text-white font-bold text-lg">AICOMPANY</h1>
          <p className="text-gray-400 text-sm">
            Supabase が未設定のため、ローカルモードで動作中です。
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => router.push('/')}
          >
            そのまま使う
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-white font-bold text-xl">AICOMPANY</h1>
          <p className="text-gray-400 text-sm">案件司令塔 — ログイン</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="text-white font-medium">メールを送信しました</p>
              <p className="text-gray-400 text-sm">
                <span className="text-blue-400">{email}</span> に
                ログインリンクを送りました。
              </p>
              <p className="text-gray-500 text-xs">
                メール内のリンクをクリックするとログインできます。
              </p>
            </div>
            <button
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              onClick={() => setSent(false)}
            >
              メールアドレスを変更する
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">メールアドレス</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="pl-9 bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-500 h-10"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
            >
              {loading ? '送信中...' : 'マジックリンクを送る'}
            </Button>

            <p className="text-center text-xs text-gray-600">
              パスワード不要。メールのリンクをクリックするだけです。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
