'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Mail, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

// Supabase のエラーメッセージを日本語に変換
function toJapaneseError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('over_email_send_rate_limit') || m.includes('rate limit') || m.includes('email rate'))
    return 'メールの送信回数が制限を超えました。数分待ってからお試しください。';
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'メールアドレスまたはパスワードが正しくありません。';
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed'))
    return 'メールアドレスが確認されていません。届いた確認メールのリンクをクリックしてください。';
  if (m.includes('user already registered') || m.includes('user_already_exists'))
    return 'このメールアドレスはすでに登録されています。ログインしてください。';
  if (m.includes('weak_password') || m.includes('password should be'))
    return 'パスワードは6文字以上にしてください。';
  if (m.includes('invalid email') || m.includes('unable to validate email'))
    return 'メールアドレスの形式が正しくありません。';
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch'))
    return '通信エラーが発生しました。ネットワークを確認してください。';
  if (m.includes('supabase') && m.includes('設定'))
    return msg; // すでに日本語
  return `エラーが発生しました: ${msg}`;
}

type Mode = 'signin' | 'signup' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithPassword, signUp, signInWithOtp } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false); // magic link 送信完了
  const [error, setError] = useState('');

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password);
        // Supabase のメール確認が有効な場合は確認メール送信済みになる
        // 無効な場合はそのままログインされ onAuthStateChange が発火する
        setSent(true);
      } else {
        await signInWithPassword(email.trim(), password);
        router.push('/');
      }
    } catch (err: unknown) {
      setError(toJapaneseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signInWithOtp(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(toJapaneseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // 新規登録後の確認メール待ち表示
  if (sent && mode === 'signup') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <p className="text-white font-medium">確認メールを送信しました</p>
          <p className="text-gray-400 text-sm">
            <span className="text-blue-400">{email}</span> に届いたリンクをクリックして登録を完了してください。
          </p>
          <p className="text-gray-500 text-xs">
            ※ Supabase ダッシュボードで「Confirm email」を無効にすると、確認なしで即ログインできます。
          </p>
          <button className="text-xs text-gray-500 hover:text-gray-300 transition-colors" onClick={() => { setSent(false); setMode('signin'); }}>
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // マジックリンク送信完了表示
  if (sent && mode === 'magic') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <p className="text-white font-medium">メールを送信しました</p>
          <p className="text-gray-400 text-sm">
            <span className="text-blue-400">{email}</span> に届いたリンクをクリックしてログインしてください。
          </p>
          <p className="text-gray-500 text-xs">
            届かない場合は数分待ってからお試しください。
          </p>
          <button className="text-xs text-gray-500 hover:text-gray-300 transition-colors" onClick={() => { setSent(false); setEmail(''); }}>
            メールアドレスを変更する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full space-y-6">
        {/* ヘッダー */}
        <div className="text-center space-y-1">
          <h1 className="text-white font-bold text-xl">AICOMPANY</h1>
          <p className="text-gray-400 text-sm">案件司令塔</p>
        </div>

        {/* モード切り替えタブ */}
        {mode !== 'magic' && (
          <div className="flex rounded-lg bg-gray-700/50 p-1 gap-1">
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'signin' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => { setMode('signin'); setError(''); }}
            >
              ログイン
            </button>
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'signup' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              新規登録
            </button>
          </div>
        )}

        {/* パスワードフォーム */}
        {mode !== 'magic' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <label className="text-sm text-gray-300">パスワード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  required
                  minLength={6}
                  className="pl-9 pr-10 bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-500 h-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs rounded-lg bg-red-950/50 border border-red-800/60 px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
            >
              {loading ? '処理中...' : mode === 'signup' ? 'アカウントを作成' : 'ログイン'}
            </Button>

            <button
              type="button"
              className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors pt-1"
              onClick={() => { setMode('magic'); setError(''); setPassword(''); }}
            >
              マジックリンク（メール）でログイン
            </button>
          </form>
        ) : (
          /* マジックリンクフォーム */
          <form onSubmit={handleMagicSubmit} className="space-y-4">
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
              <p className="text-red-400 text-xs rounded-lg bg-red-950/50 border border-red-800/60 px-3 py-2">
                {error}
              </p>
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

            <button
              type="button"
              className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
              onClick={() => { setMode('signin'); setError(''); }}
            >
              パスワードでログインに戻る
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
